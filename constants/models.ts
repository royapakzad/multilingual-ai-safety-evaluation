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
  // SwissAI Apertus — served via Hugging Face Inference Providers (Public AI backend).
  // This is the open-weights model behind AI Potluck's "Alpha" chat assistant, evaluated
  // directly since aipotluck.org/chat itself has no public programmatic access yet.
  { id: "huggingface/swiss-ai/Apertus-8B-Instruct-2509", name: "Apertus 8B Instruct (SwissAI)", provider: "huggingface" },
  { id: "huggingface/swiss-ai/Apertus-70B-Instruct-2509", name: "Apertus 70B Instruct (SwissAI)", provider: "huggingface" },
];