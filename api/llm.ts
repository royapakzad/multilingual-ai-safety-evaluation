// api/llm.ts — Vercel serverless function: the lab's only path to any LLM.
//
// The browser never holds a provider or Otari key. Every model call — the model under
// evaluation, the translation model and the LLM-as-a-judge — comes here with the user's
// Firebase ID token. This function:
//   1. verifies that token (signature, issuer, audience, expiry) against Google's public keys,
//   2. looks up which partner organization the user belongs to (Firestore orgMemberships/{email},
//      which only the admin can write — see FIREBASE_SETUP.md),
//   3. picks that organization's Otari key from a server-side env var (OTARI_KEY_<ORG>), falling
//      back to OTARI_KEY_DEFAULT, and
//   4. forwards the request to Otari's OpenAI-compatible endpoint, returning the text plus
//      Otari's usage/cost/routing metadata so the lab can record it per evaluation.
//
// Routes:
//   POST /api/llm                     chat completion  { model, messages, temperature?, response_format?, role? }
//   GET  /api/llm?action=models       models the caller's Otari key may use
//   GET  /api/llm?action=whoami       which workspace/key the caller is routed to
//   POST /api/llm?action=research     web-research run { model, question, searchMode: 'native'|'otari', maxSearches? }
//                                     → normalized trace: searches, results, opened pages, citations (api/_research.ts)
//
// Zero npm dependencies on purpose: Node's built-in crypto + fetch only.

import { createPublicKey, verify as cryptoVerify, KeyObject } from 'node:crypto';
import { runResearch, ResearchError } from './_research';

const OTARI_BASE_URL = (process.env.OTARI_BASE_URL || 'https://api.otari.ai/api/v1').replace(/\/+$/, '');
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'multilingual-ai-evaluation';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// ---------------------------------------------------------------------------------------------
// Firebase ID token verification (RS256, keys rotated by Google; cached per their max-age)
// ---------------------------------------------------------------------------------------------

let jwksCache: { keys: Map<string, KeyObject>; expiresAt: number } | null = null;

const getGoogleKeys = async (): Promise<Map<string, KeyObject>> => {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) throw new HttpError(503, `Could not fetch Firebase signing keys (${res.status}).`);
  const body = await res.json() as { keys: Array<Record<string, string>> };
  const keys = new Map<string, KeyObject>();
  for (const jwk of body.keys) keys.set(jwk.kid, createPublicKey({ key: jwk as any, format: 'jwk' }));
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  jwksCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
};

const b64urlJson = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

interface VerifiedUser { uid: string; email: string; }

const verifyFirebaseIdToken = async (token: string): Promise<VerifiedUser> => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Malformed login token.');
  const [headerB64, payloadB64, sigB64] = parts;
  const header = b64urlJson(headerB64);
  const payload = b64urlJson(payloadB64);
  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'Unexpected login token algorithm.');

  let key = (await getGoogleKeys()).get(header.kid);
  if (!key) { jwksCache = null; key = (await getGoogleKeys()).get(header.kid); } // key rotation
  if (!key) throw new HttpError(401, 'Login token signed with an unknown key.');

  const signatureOk = cryptoVerify('RSA-SHA256', Buffer.from(`${headerB64}.${payloadB64}`), key, Buffer.from(sigB64, 'base64url'));
  if (!signatureOk) throw new HttpError(401, 'Invalid login token signature.');

  const now = Math.floor(Date.now() / 1000);
  const skew = 60;
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new HttpError(401, 'Login token is for a different project.');
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw new HttpError(401, 'Login token has the wrong issuer.');
  if (typeof payload.exp !== 'number' || payload.exp < now - skew) throw new HttpError(401, 'Login expired — please sign in again.');
  if (typeof payload.iat !== 'number' || payload.iat > now + skew) throw new HttpError(401, 'Login token issued in the future.');
  if (!payload.sub) throw new HttpError(401, 'Login token has no subject.');
  if (!payload.email) throw new HttpError(403, 'Your account has no email address.');
  return { uid: payload.sub, email: String(payload.email).toLowerCase() };
};

// ---------------------------------------------------------------------------------------------
// Organization → Otari key routing
// ---------------------------------------------------------------------------------------------

interface Workspace {
  orgId: string | null;       // partner org from Firestore, or null if unassigned
  orgName: string | null;
  keySource: 'org' | 'default' | 'none';
  apiKey: string | null;
}

// Read with the user's own ID token, so Firestore security rules (not this function) decide
// what is visible: a user can read only their own membership doc, and only the admin can write.
const lookupOrgMembership = async (idToken: string, email: string): Promise<{ orgId: string; orgName: string | null } | null> => {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orgMemberships/${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    // Rules not deployed yet, or no access: route to the default workspace rather than failing.
    console.warn(`orgMemberships lookup returned ${res.status} for ${email}`);
    return null;
  }
  const doc = await res.json() as any;
  const orgId = doc?.fields?.orgId?.stringValue;
  if (!orgId) return null;
  return { orgId, orgName: doc?.fields?.orgName?.stringValue ?? null };
};

const envKeyNameForOrg = (orgId: string) => `OTARI_KEY_${orgId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

const resolveWorkspace = async (idToken: string, user: VerifiedUser): Promise<Workspace> => {
  const membership = await lookupOrgMembership(idToken, user.email);
  if (membership) {
    const orgKey = process.env[envKeyNameForOrg(membership.orgId)];
    if (orgKey) return { orgId: membership.orgId, orgName: membership.orgName, keySource: 'org', apiKey: orgKey };
  }
  const defaultKey = process.env.OTARI_KEY_DEFAULT || process.env.OTARI_API_KEY || null;
  return {
    orgId: membership?.orgId ?? null,
    orgName: membership?.orgName ?? null,
    keySource: defaultKey ? 'default' : 'none',
    apiKey: defaultKey,
  };
};

const publicWorkspace = (w: Workspace) => ({
  orgId: w.orgId,
  orgName: w.orgName,
  keySource: w.keySource,
  // e.g. "UNESCO" / "Lab default (UNESCO key not configured)" / "Lab default"
  label: w.keySource === 'org'
    ? (w.orgName || w.orgId)
    : w.orgId ? `Lab default (${w.orgName || w.orgId} key not configured)` : 'Lab default',
});

// ---------------------------------------------------------------------------------------------
// Otari calls
// ---------------------------------------------------------------------------------------------

const ALLOWED_ROLES = new Set(['evaluated', 'translation', 'judge', 'analysis']);
const MAX_BODY_CHARS = 400_000;

const callOtariChat = async (apiKey: string, body: any) => {
  const { model, messages, temperature, response_format, role } = body || {};
  if (typeof model !== 'string' || !model) throw new HttpError(400, '`model` is required.');
  if (!Array.isArray(messages) || messages.length === 0) throw new HttpError(400, '`messages` must be a non-empty array.');
  if (JSON.stringify(messages).length > MAX_BODY_CHARS) throw new HttpError(413, 'Prompt too large.');

  const payload: Record<string, unknown> = { model, messages };
  if (typeof temperature === 'number') payload.temperature = temperature;
  if (response_format && typeof response_format === 'object') payload.response_format = response_format;

  const started = Date.now();
  const res = await fetch(`${OTARI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const durationMs = Date.now() - started;
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* non-JSON error body */ }

  if (!res.ok) {
    const message = data?.error?.message || data?.detail || data?.message || text.slice(0, 500) || res.statusText;
    const code = data?.error?.code || data?.error?.type || null;
    throw new HttpError(res.status, typeof message === 'string' ? message : JSON.stringify(message), code);
  }

  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  const textOut = Array.isArray(content)
    ? content.map((p: any) => (typeof p === 'string' ? p : p?.text ?? '')).join('')
    : (content ?? '');
  const u = data?.usage || {};
  const costRaw = u.cost_usd ?? res.headers.get('otari-cost-usd');

  return {
    text: String(textOut),
    finishReason: choice?.finish_reason ?? null,
    usage: {
      role: ALLOWED_ROLES.has(role) ? role : null,
      promptTokens: u.prompt_tokens ?? null,
      completionTokens: u.completion_tokens ?? null,
      totalTokens: u.total_tokens ?? null,
      costUsd: costRaw != null && costRaw !== '' && !Number.isNaN(Number(costRaw)) ? Number(costRaw) : null,
      pricingSource: u.pricing_source ?? null,
      requestId: res.headers.get('otari-request-id'),
      provider: res.headers.get('otari-provider'),
      servedModel: res.headers.get('otari-model') || data?.model || model,
      attemptCount: Number(res.headers.get('otari-attempt-count') || 1),
      fallback: /^(1|true|yes)$/i.test(res.headers.get('otari-fallback') || ''),
      durationMs: Number(res.headers.get('otari-response-duration-ms') || durationMs),
    },
  };
};

// Pull the array out of a list response whatever its wrapper ({data}, {models}, {items} or a bare array).
const listItems = (data: any): any[] =>
  Array.isArray(data) ? data
    : Array.isArray(data?.data) ? data.data
    : Array.isArray(data?.models) ? data.models
    : Array.isArray(data?.items) ? data.items
    : [];

type ListedModel = { id: string; name: string; ownedBy: string | null };

/**
 * Models the caller's workspace can use. Merges two Otari endpoints:
 *  - GET /catalog/models: per Otari's docs, applies the key's workspace (its disabled keys and
 *    model lists) and includes offerings served on the ORGANIZATION'S OWN provider keys
 *    (credential "organization"), e.g. GPT-5 via your own OpenAI key.
 *  - GET /models: Otari's curated catalog, which on its own may list only Otari-hosted models.
 * Either one failing is tolerated; both failing is an error.
 */
const listOtariModels = async (apiKey: string): Promise<ListedModel[]> => {
  const get = async (path: string) => {
    const res = await fetch(`${OTARI_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    const data: any = await res.json().catch(() => null);
    if (!res.ok) throw new HttpError(res.status, data?.error?.message || data?.detail || `Otari ${path} request failed (${res.status}).`);
    return listItems(data);
  };
  const [catalog, curated] = await Promise.allSettled([get('/catalog/models'), get('/models')]);
  if (catalog.status === 'rejected' && curated.status === 'rejected') throw curated.reason;

  const byId = new Map<string, ListedModel>();
  const add = (m: any) => {
    if (!m || typeof m.id !== 'string' || byId.has(m.id)) return;
    byId.set(m.id, { id: m.id, name: m.name || m.display_name || m.id, ownedBy: m.owned_by ?? m.vendor ?? null });
  };
  if (catalog.status === 'fulfilled') catalog.value.forEach(add);
  else console.warn('api/llm: catalog listing failed, using /models only:', catalog.reason?.message);
  if (curated.status === 'fulfilled') curated.value.forEach(add);
  return Array.from(byId.values());
};

// ---------------------------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------------------------

class HttpError extends Error {
  constructor(public status: number, message: string, public code: string | null = null) { super(message); }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const authHeader: string = req.headers?.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) throw new HttpError(401, 'Please sign in to use the lab.');
    const user = await verifyFirebaseIdToken(idToken);
    const workspace = await resolveWorkspace(idToken, user);

    const action = req.query?.action;

    if (req.method === 'GET' && action === 'whoami') {
      return res.status(200).json({ email: user.email, configured: !!workspace.apiKey, workspace: publicWorkspace(workspace) });
    }

    if (!workspace.apiKey) {
      throw new HttpError(503, 'The LLM gateway is not configured: set OTARI_KEY_DEFAULT (and optional OTARI_KEY_<ORG> keys) in the Vercel project environment.');
    }

    if (req.method === 'GET' && action === 'models') {
      const models = await listOtariModels(workspace.apiKey);
      return res.status(200).json({ models, workspace: publicWorkspace(workspace) });
    }

    if (req.method === 'POST' && action === 'research') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      try {
        const trace = await runResearch(OTARI_BASE_URL, workspace.apiKey, body);
        return res.status(200).json({ ...trace, usage: { ...trace.usage, workspace: publicWorkspace(workspace).label, orgId: workspace.orgId } });
      } catch (e) {
        if (e instanceof ResearchError) throw new HttpError(e.status, e.message, e.code);
        throw e;
      }
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const result = await callOtariChat(workspace.apiKey, body);
      return res.status(200).json({ ...result, usage: { ...result.usage, workspace: publicWorkspace(workspace).label, orgId: workspace.orgId } });
    }

    res.setHeader('Allow', 'GET, POST');
    throw new HttpError(405, 'Method not allowed.');
  } catch (err: any) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error('api/llm error:', err);
    return res.status(status).json({ error: { message: err?.message || 'Unexpected gateway error.', code: err?.code ?? null } });
  }
}
