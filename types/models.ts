// types/models.ts

import { ProviderType } from './common';

/**
 * Model ID string. Static models use 'provider/model-name' format.
 * OpenRouter models use 'openrouter/provider/model-name' format.
 */
export type LLMModelType = string;

/**
 * Defines the structure for a model, including its display name and provider.
 */
export interface ModelDefinition {
  id: string;
  name: string;
  provider: ProviderType;
}
