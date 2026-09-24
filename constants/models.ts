// constants/models.ts

import { ModelDefinition } from '../types';

/**
 * A list of all LLM models available for selection in the application.
 * This is the single source of truth for which models are supported.
 */
export const AVAILABLE_MODELS: ModelDefinition[] = [
  { id: "openai/gpt-4o", name: "OpenAI GPT-4o", provider: "openai" },
  { id: "gemini/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini" },
  { id: "mistral/mistral-small-latest", name: "Mistral Small", provider: "mistral" },
  // SwissAI Apertus — the model behind AI Potluck's "Alpha" chat assistant, evaluated
  // directly since aipotluck.org/chat itself has no public programmatic access yet.
  // Served via Hugging Face Inference Providers, which is a volatile registry: individual
  // providers can add/drop a model at any time, independent of us. CONFIRM these two IDs
  // are still listed as "live" at https://router.huggingface.co/v1/models before relying
  // on results from them — don't assume this comment stays accurate.
  //
  // Verified live as of 2026-09-24:
  //   Apertus-v1.5-70B          -> publicai, featherless-ai   (the real "1.5" 70B release — used below)
  //   Apertus-v1.5-8B           -> NOT served by anyone right now (was live 2026-09-18, dropped since)
  //   Apertus-8B-Instruct-2509  -> publicai   (used below instead: an older, non-"1.5" 8B checkpoint —
  //                                 the only 8B currently live at all; label says so explicitly)
  //   Apertus-70B-Instruct-2509 -> also live (publicai, featherless-ai), but NOT used here since the
  //                                 real v1.5 70B is available and more representative of "Apertus 1.5"
  { id: "huggingface/swiss-ai/Apertus-8B-Instruct-2509", name: "Apertus 8B Instruct-2509 (SwissAI, not v1.5)", provider: "huggingface" },
  { id: "huggingface/swiss-ai/Apertus-v1.5-70B", name: "Apertus 1.5 70B (SwissAI)", provider: "huggingface" },
];