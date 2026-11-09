// constants/api.ts

/**
 * All LLM traffic goes through the serverless gateway at /api/llm (api/llm.ts), which calls
 * Otari with a server-side key. No provider or Otari key is ever shipped to the browser.
 *
 * Server-side environment variables (Vercel → Project → Settings → Environment Variables):
 *   OTARI_KEY_DEFAULT      Otari key for evaluators not assigned to a partner organization
 *   OTARI_KEY_<ORG_ID>     Otari key for a partner org, e.g. OTARI_KEY_UNESCO
 *   OTARI_BASE_URL         optional; defaults to https://api.otari.ai/api/v1 (EU: https://eu.api.otari.ai/api/v1)
 *   FIREBASE_PROJECT_ID    optional; defaults to the lab's Firebase project
 */
export const LLM_GATEWAY_PATH = '/api/llm';
