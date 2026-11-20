// constants/models.ts

import { ModelDefinition, ModelLicense } from '../types';

/**
 * All model calls go through Otari, so the authoritative list of what can be used is whatever
 * the caller's Otari key returns from GET /api/v1/models (see fetchGatewayModels) — that list is
 * filtered by Otari to the key's model allow-list, which is how each partner org's workspace
 * controls which models its evaluators may use.
 *
 * SUGGESTED_MODELS are a curated starting set mixing open-weight and proprietary models. In the
 * pickers they are only shown when the live Otari list confirms them (or when that list cannot
 * be loaded). IDs follow Otari's formats: 'provider:model' pins a provider; catalog 'vendor/model'
 * lets Otari pick (and fall back between) providers. Check them against your Otari dashboard's
 * model catalog and adjust — provider catalogs change often.
 */
export const SUGGESTED_MODELS: ModelDefinition[] = [
  // Open-weight
  { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", provider: "otari", license: "open-weight" },
  { id: "z-ai/glm-5.3", name: "GLM 5.3 (Z.ai)", provider: "otari", license: "open-weight" },
  { id: "huggingface:swiss-ai/Apertus-v1.5-70B", name: "Apertus 1.5 70B (SwissAI)", provider: "otari", license: "open-weight" },
  { id: "huggingface:swiss-ai/Apertus-8B-Instruct-2509", name: "Apertus 8B Instruct (SwissAI)", provider: "otari", license: "open-weight" },
  { id: "mistral:mistral-small-latest", name: "Mistral Small", provider: "otari", license: "open-weight" },
  // Proprietary
  { id: "openai:gpt-5", name: "GPT-5 (OpenAI)", provider: "otari", license: "proprietary" },
  { id: "anthropic:claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Anthropic)", provider: "otari", license: "proprietary" },
  { id: "gemini:gemini-3-flash-preview", name: "Gemini 3 Flash (Google)", provider: "otari", license: "proprietary" },
];

/** Defaults for the three roles; each is user-selectable and remembered per browser. */
export const DEFAULT_EVALUATED_MODEL = SUGGESTED_MODELS[0].id;
export const DEFAULT_TRANSLATION_MODEL = "gemini:gemini-3-flash-preview";
export const DEFAULT_JUDGE_MODEL = "anthropic:claude-sonnet-4-6";

/** Judge used for every record saved before the judge became selectable. */
export const LEGACY_JUDGE_MODEL = "gemini/gemini-2.5-flash";

/**
 * Models referenced by records saved before the Otari migration (direct provider SDKs).
 * Kept only so the dashboard and reports still show readable names; never offered in pickers.
 */
const LEGACY_MODELS: ModelDefinition[] = [
  { id: "gemini/gemini-2.5-flash", name: "Gemini 2.5 Flash (legacy)", provider: "gemini", license: "proprietary", legacy: true },
  { id: "huggingface/swiss-ai/Apertus-8B-Instruct-2509", name: "Apertus 8B Instruct-2509 (legacy)", provider: "huggingface", license: "open-weight", legacy: true },
  { id: "huggingface/swiss-ai/Apertus-v1.5-70B", name: "Apertus 1.5 70B (legacy)", provider: "huggingface", license: "open-weight", legacy: true },
];

/** Every model with a known display name (suggested + legacy). */
export const AVAILABLE_MODELS: ModelDefinition[] = [...SUGGESTED_MODELS, ...LEGACY_MODELS];

// Order matters: open-weight families are checked first so e.g. "gpt-oss" and "gemma" are not
// mistaken for their proprietary siblings.
const OPEN_WEIGHT_PATTERNS = /(gpt-oss|gemma|llama|qwen|deepseek|glm|kimi|apertus|mixtral|mistral-small|mistral-nemo|ministral|magistral-small|devstral|phi-|olmo|falcon|aya|smollm|granite|nemotron|hermes|minimax)/i;
const PROPRIETARY_PATTERNS = /(claude|gemini|gpt-|chatgpt|(^|[:/])o[134](-|$)|grok|mistral-large|mistral-medium|command-r|sonar)/i;

export const classifyModelLicense = (modelId: string): ModelLicense => {
  if (OPEN_WEIGHT_PATTERNS.test(modelId)) return 'open-weight';
  if (PROPRIETARY_PATTERNS.test(modelId)) return 'proprietary';
  return 'unknown';
};

/** "anthropic:claude-sonnet-4-6" → "claude-sonnet-4-6 · anthropic" */
export const prettifyModelId = (modelId: string): string => {
  const sep = modelId.indexOf(':');
  if (sep > 0) return `${modelId.slice(sep + 1)} · ${modelId.slice(0, sep)}`;
  return modelId;
};

/** Display name for any model id, including legacy and ad-hoc Otari ids. */
export const getModelDisplayName = (modelId: string | null | undefined): string => {
  if (!modelId) return 'Unknown model';
  return AVAILABLE_MODELS.find(m => m.id === modelId)?.name ?? prettifyModelId(modelId);
};
