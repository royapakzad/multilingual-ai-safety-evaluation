// types/common.ts

/**
 * Defines the supported LLM providers.
 */
export type ProviderType = 'otari' | 'gemini' | 'openai' | 'mistral' | 'openrouter' | 'huggingface';

/** Whether a model's weights are openly released. Drives grouping/badges in the model pickers. */
export type ModelLicense = 'open-weight' | 'proprietary' | 'unknown';

/**
 * Represents a single chat message in the UI, with optional error state.
 */
export interface ChatMessage {
  text: string;
  isError?: boolean;
}

/**
 * Defines the user object, including their role for access control.
 */
export interface User {
  email: string;
  role: 'admin' | 'evaluator';
}

/**
 * Defines the available UI themes.
 */
export type Theme = 'light' | 'dark';
