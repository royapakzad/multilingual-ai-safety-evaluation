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
  // SwissAI Apertus v1.5 — the model behind AI Potluck's "Alpha" chat assistant, evaluated
  // directly since aipotluck.org/chat itself has no public programmatic access yet.
  // Served via Hugging Face Inference Providers. Verified live on the router as of 2026-09-18:
  //   Apertus-v1.5-8B  -> publicai
  //   Apertus-v1.5-70B -> publicai, featherless-ai
  // (The older "-Instruct-2509" repo IDs are a different, non-"1.5" release; the 70B variant
  // of that line is NOT served by any provider, which is why it failed.)
  { id: "huggingface/swiss-ai/Apertus-v1.5-8B", name: "Apertus 1.5 8B (SwissAI)", provider: "huggingface" },
  { id: "huggingface/swiss-ai/Apertus-v1.5-70B", name: "Apertus 1.5 70B (SwissAI)", provider: "huggingface" },
];