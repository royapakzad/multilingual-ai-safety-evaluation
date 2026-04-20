// types/common.ts

/**
 * Defines the supported LLM providers.
 */
export type ProviderType = 'gemini' | 'openai' | 'mistral' | 'openrouter';

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
