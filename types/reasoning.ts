// types/reasoning.ts

import { LLMModelType, LanguageSpecificRubricScores, HarmDisparityMetrics } from './';
import { LlmEvaluation } from './llm-judge';

/**
 * Represents a complete evaluation record from the A/B Comparison Lab.
 * This structure is generic to support comparing any two prompts, models, or configurations.
 */
export interface ReasoningEvaluationRecord {
  id: string;
  timestamp: string;
  userEmail: string;
  labType: 'reasoning';

  // Named evaluation session this record belongs to
  evaluationName?: string;

  // Built-in rubric dimensions (RUBRIC_DIMENSIONS keys) that were removed from this
  // evaluation's scoring form at the time this record was saved. Snapshotted rather than
  // looked up live, so a report always reflects what was actually asked of the evaluator
  // (and the LLM judge) for this specific record — not whatever the evaluation's criteria
  // configuration happens to be when the report is later viewed. Absent/undefined means
  // none were hidden (the full built-in set applied), which keeps older records valid.
  hiddenBuiltInKeys?: string[];

  // Scenario & Model Info
  scenarioId: string;
  scenarioCategory: string;
  scenarioContext?: string;
  languagePair: string;
  model: LLMModelType;
  
  // Column A Data
  titleA: string;
  promptA: string;
  reasoningRequestedA: boolean;
  rawResponseA: string;
  reasoningA: string | null;
  responseA: string;
  reasoningWordCountA: number;
  answerWordCountA: number;
  generationTimeSecondsA?: number;
  wordsPerSecondA?: number;

  // Column B Data
  titleB: string;
  promptB: string;
  reasoningRequestedB: boolean;
  rawResponseB: string;
  reasoningB: string | null;
  responseB: string;
  reasoningWordCountB: number;
  answerWordCountB: number;
  generationTimeSecondsB?: number;
  wordsPerSecondB?: number;
  // What unit reasoningWordCountB/answerWordCountB/wordsPerSecondB are actually counted in.
  // 'words' for space-delimited scripts; 'characters' for scripts (Chinese, Japanese, Thai,
  // Khmer, Lao, Burmese) that don't use whitespace between words, where a word count is
  // meaningless. Column A is always English, so it's always 'words' and needs no field.
  // Absent on older records means 'words' — the only thing ever computed before this existed.
  nativeCountUnit?: 'words' | 'characters';

  // Human Evaluation
  humanScores: {
    english: LanguageSpecificRubricScores;
    native: LanguageSpecificRubricScores;
    disparity: HarmDisparityMetrics;
  };
  notes: string; // Human notes
  
  isFlaggedForReview?: boolean;

  // LLM as Judge
  llmScores?: LlmEvaluation;
  llmEvaluationStatus: 'not_started' | 'pending' | 'completed' | 'failed';
  llmEvaluationError?: string;
}
