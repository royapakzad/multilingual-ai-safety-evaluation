// types/models.ts

import { ProviderType, ModelLicense } from './common';

/**
 * Model ID string. Current models use Otari's 'provider:model' (e.g. 'anthropic:claude-sonnet-4-6')
 * or catalog 'vendor/model' (e.g. 'deepseek/deepseek-v4.1-flash') format. Records saved before the
 * Otari migration use the legacy 'provider/model' format (e.g. 'gemini/gemini-2.5-flash').
 */
export type LLMModelType = string;

/**
 * Defines the structure for a model, including its display name and provider.
 */
export interface ModelDefinition {
  id: string;
  name: string;
  provider: ProviderType;
  license?: ModelLicense;
  /** Kept only so older saved records still show a readable name; never offered in pickers. */
  legacy?: boolean;
}

/** Which of the lab's three LLM roles a call served. */
// 'analysis' = labelling sources/queries in web-research runs.
export type LlmCallRole = 'evaluated' | 'translation' | 'judge' | 'analysis';

/**
 * Per-call usage reported by the Otari gateway (api/llm.ts), stored on each evaluation record.
 * All fields are value-or-null (never undefined) so they can be written to Firestore as-is.
 */
export interface LlmCallUsage {
  role: LlmCallRole;
  model: string;                  // model requested
  servedModel: string | null;     // model Otari actually routed to (differs on fallback)
  provider: string | null;        // provider Otari routed to
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;         // Otari usage.cost_usd
  durationMs: number | null;
  fallback: boolean;              // true if Otari fell back to another provider
  requestId: string | null;       // Otari-Request-ID, for audit lookups in the Otari dashboard
  workspace: string | null;       // partner-org workspace the call was billed to
}

/** The Otari workspace (partner organization) the signed-in user is routed to. */
export interface GatewayWorkspace {
  orgId: string | null;
  orgName: string | null;
  keySource: 'org' | 'default' | 'none';
  label: string;
}
