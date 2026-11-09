// api/_research.ts — web-research runs through Otari (the leading underscore keeps Vercel from
// exposing this file as its own route; api/llm.ts imports it).
//
// Three ways a model can search, all through Otari, all normalized to ONE trace shape:
//   - 'anthropic': Claude's own search      → POST /messages   with the web_search server tool
//   - 'openai':    OpenAI's own search      → POST /responses  with the web_search tool
//   - 'otari':     Otari's search (Tavily)  → POST /chat/completions with otari_web_search (+ fetch)
// searchMode 'native' uses the model's own search where it has one and Otari's otherwise;
// searchMode 'otari' uses Otari's for every model (the controlled condition).

export type SearchEngine = 'anthropic' | 'openai' | 'otari';

export interface TraceResult { url: string; title: string; date: string | null; rank: number }
export interface TraceSearch { index: number; query: string; results: TraceResult[] }
export interface TraceCitation { url: string; title: string; quote: string }
export interface ResearchTraceOut {
  answer: string;
  engine: SearchEngine;
  searches: TraceSearch[];
  opened: string[];
  citations: TraceCitation[];
  usage: Record<string, unknown>;
}

export class ResearchError extends Error {
  constructor(public status: number, message: string, public code: string | null = null) { super(message); }
}

/** Which search a model gets. Native search is only available for Anthropic and OpenAI models. */
export const engineFor = (model: string, mode: 'native' | 'otari'): SearchEngine => {
  if (mode === 'otari') return 'otari';
  const m = model.toLowerCase();
  if (/^anthropic[:/]/.test(m) || (!m.includes('/') && !m.includes(':') && m.startsWith('claude'))) return 'anthropic';
  if (/^openai[:/]/.test(m) && !/gpt-oss/.test(m)) return 'openai';
  return 'otari';
};

const num = (x: unknown) => (x != null && x !== '' && !Number.isNaN(Number(x)) ? Number(x) : null);

// Markdown links and bare URLs in an answer → citations (used where the engine gives none).
export const citationsFromMarkdown = (text: string): TraceCitation[] => {
  const out: TraceCitation[] = [];
  const seen = new Set<string>();
  const add = (url: string, title: string) => {
    const clean = url.replace(/[).,;]+$/, '');
    if (!seen.has(clean)) { seen.add(clean); out.push({ url: clean, title, quote: '' }); }
  };
  for (const m of text.matchAll(/\[([^\]]{1,300})\]\((https?:\/\/[^\s)]+)\)/g)) add(m[2], m[1]);
  for (const m of text.matchAll(/(?<![(\[])\bhttps?:\/\/[^\s<>"'\])]+/g)) add(m[0], '');
  return out;
};

// --- Normalizers (pure; tested against real Otari responses) ----------------------------------

export const normalizeOtariChat = (data: any): Omit<ResearchTraceOut, 'usage'> => {
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  const answer = Array.isArray(content) ? content.map((p: any) => p?.text ?? '').join('') : String(content ?? '');
  const searches: TraceSearch[] = [];
  const opened: string[] = [];
  for (const call of data?.otari_tool_calls ?? []) {
    const type = String(call?.type ?? '');
    if (type.includes('search')) {
      searches.push({
        index: searches.length + 1,
        query: String(call?.query ?? ''),
        results: (call?.sources ?? []).map((s: any, i: number) => ({
          url: String(s?.url ?? ''), title: String(s?.title ?? ''), date: s?.published_date ?? s?.date ?? null, rank: i + 1,
        })).filter((r: TraceResult) => r.url),
      });
    } else if (type.includes('fetch') && (call?.url || call?.source?.url)) {
      opened.push(String(call.url ?? call.source.url));
    }
  }
  return { answer, engine: 'otari', searches, opened, citations: citationsFromMarkdown(answer) };
};

export const normalizeAnthropic = (data: any): Omit<ResearchTraceOut, 'usage'> => {
  const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
  const searches: TraceSearch[] = [];
  const opened: string[] = [];
  const citations: TraceCitation[] = [];
  const seen = new Set<string>();
  const queryById = new Map<string, string>();
  let answer = '';
  for (const b of blocks) {
    if (b?.type === 'server_tool_use') {
      if (b.name === 'web_search') queryById.set(b.id, String(b.input?.query ?? ''));
      if (b.name === 'web_fetch' && b.input?.url) opened.push(String(b.input.url));
    } else if (b?.type === 'web_search_tool_result') {
      const results = Array.isArray(b.content) ? b.content : [];
      searches.push({
        index: searches.length + 1,
        query: queryById.get(b.tool_use_id) ?? '',
        results: results.filter((r: any) => r?.url).map((r: any, i: number) => ({
          url: String(r.url), title: String(r.title ?? ''), date: r.page_age ?? null, rank: i + 1,
        })),
      });
    } else if (b?.type === 'text') {
      answer += b.text ?? '';
      for (const c of b.citations ?? []) {
        if (!c?.url) continue;
        const key = `${c.url}|${c.cited_text ?? ''}`;
        if (!seen.has(key)) { seen.add(key); citations.push({ url: String(c.url), title: String(c.title ?? ''), quote: String(c.cited_text ?? '') }); }
      }
    }
  }
  return { answer, engine: 'anthropic', searches, opened, citations: citations.length ? citations : citationsFromMarkdown(answer) };
};

export const normalizeOpenAI = (data: any): Omit<ResearchTraceOut, 'usage'> => {
  const items: any[] = Array.isArray(data?.output) ? data.output : [];
  const searches: TraceSearch[] = [];
  const opened: string[] = [];
  const citations: TraceCitation[] = [];
  const seen = new Set<string>();
  let answer = '';
  for (const it of items) {
    if (it?.type === 'web_search_call') {
      const a = it.action ?? {};
      if (a.type === 'search') {
        const query = String(a.query ?? (Array.isArray(a.queries) ? a.queries.join(' | ') : ''));
        searches.push({
          index: searches.length + 1, query,
          results: (a.sources ?? []).filter((s: any) => s?.url).map((s: any, i: number) => ({
            url: String(s.url), title: String(s.title ?? ''), date: null, rank: i + 1,
          })),
        });
      } else if ((a.type === 'open_page' || a.type === 'find_in_page') && a.url) {
        opened.push(String(a.url));
      }
    } else if (it?.type === 'message') {
      for (const c of it.content ?? []) {
        if (c?.type !== 'output_text' && typeof c?.text !== 'string') continue;
        answer += c.text ?? '';
        for (const an of c.annotations ?? []) {
          if (an?.type !== 'url_citation' || !an.url) continue;
          const url = String(an.url).replace(/[?&]utm_source=openai$/, '');
          const quote = typeof an.start_index === 'number' && typeof an.end_index === 'number' ? String(c.text).slice(an.start_index, an.end_index) : '';
          if (!seen.has(url)) { seen.add(url); citations.push({ url, title: String(an.title ?? ''), quote }); }
        }
      }
    }
  }
  return { answer, engine: 'openai', searches, opened: [...new Set(opened)], citations };
};

// --- Running a research request ---------------------------------------------------------------

const MAX_QUESTION_CHARS = 8000;

export const runResearch = async (baseUrl: string, apiKey: string, body: any): Promise<ResearchTraceOut> => {
  const { model, question, searchMode, maxSearches } = body || {};
  if (typeof model !== 'string' || !model) throw new ResearchError(400, '`model` is required.');
  if (typeof question !== 'string' || !question.trim()) throw new ResearchError(400, '`question` is required.');
  if (question.length > MAX_QUESTION_CHARS) throw new ResearchError(413, 'Question too long.');
  const mode: 'native' | 'otari' = searchMode === 'otari' ? 'otari' : 'native';
  const maxUses = Math.min(Math.max(Number(maxSearches) || 3, 1), 8);
  const engine = engineFor(model, mode);

  let path: string, headers: Record<string, string>, payload: Record<string, unknown>;
  if (engine === 'anthropic') {
    path = '/messages';
    headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    payload = { model, max_tokens: 2000, messages: [{ role: 'user', content: question }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxUses }] };
  } else if (engine === 'openai') {
    path = '/responses';
    headers = { Authorization: `Bearer ${apiKey}` };
    payload = { model, input: question, max_output_tokens: 6000, tools: [{ type: 'web_search' }], include: ['web_search_call.action.sources'] };
  } else {
    path = '/chat/completions';
    headers = { Authorization: `Bearer ${apiKey}` };
    payload = { model, max_tokens: 2000, messages: [{ role: 'user', content: question }],
      tools: [{ type: 'otari_web_search', max_uses: maxUses }, { type: 'otari_web_fetch' }] };
  }

  const started = Date.now();
  const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const durationMs = Date.now() - started;
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const message = data?.error?.message || data?.detail || data?.message || text.slice(0, 500) || res.statusText;
    throw new ResearchError(res.status, typeof message === 'string' ? message : JSON.stringify(message), data?.error?.code || data?.error?.type || null);
  }

  const trace = engine === 'anthropic' ? normalizeAnthropic(data) : engine === 'openai' ? normalizeOpenAI(data) : normalizeOtariChat(data);
  const u = data?.usage || {};
  const promptTokens = u.prompt_tokens ?? u.input_tokens ?? null;
  const completionTokens = u.completion_tokens ?? u.output_tokens ?? null;
  return {
    ...trace,
    usage: {
      role: 'evaluated',
      promptTokens, completionTokens,
      totalTokens: u.total_tokens ?? (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null),
      costUsd: num(u.cost_usd ?? res.headers.get('otari-cost-usd')),
      pricingSource: u.pricing_source ?? null,
      searchCount: trace.searches.length,
      requestId: res.headers.get('otari-request-id'),
      provider: res.headers.get('otari-provider'),
      servedModel: res.headers.get('otari-model') ?? data?.model ?? null,
      attemptCount: Number(res.headers.get('otari-attempt-count') || 1),
      fallback: /^(1|true|yes)$/i.test(res.headers.get('otari-fallback') || ''),
      durationMs: Number(res.headers.get('otari-response-duration-ms') || durationMs),
    },
  };
};
