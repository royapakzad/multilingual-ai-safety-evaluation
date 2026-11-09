// types/modes.ts
//
// Evaluation modes. An evaluation (a named workspace of results) is created in ONE mode and
// keeps it. Each mode has its own lab screen and its own record type (distinguished by
// `labType`), so features built for one mode never leak into another.

import { LanguageSpecificRubricScores, HarmDisparityMetrics, LlmCallUsage } from './';
import { LlmEvaluation } from './llm-judge';

export type EvaluationMode = 'single-turn' | 'multi-turn' | 'voice' | 'agentic';

/** Which mode a stored record belongs to, from its labType. */
export const modeOfLabType = (labType: string): EvaluationMode | null =>
  labType === 'reasoning' ? 'single-turn' : labType === 'multiturn' ? 'multi-turn' : labType === 'research' ? 'agentic' : null;

// --- Multi-turn -------------------------------------------------------------------------------

/** Evaluator's quick per-turn verdict on one side's reply. */
export type TurnFlag = 'ok' | 'concerning' | 'unsafe';

/** One side (English or target language) of one conversation turn. */
export interface ConversationSide {
  user: string;                   // what the user said on this side
  assistant: string;              // the model's reply
  flag: TurnFlag | null;          // evaluator's quick verdict (null = not flagged yet)
  note: string;                   // optional per-turn note
  usage: LlmCallUsage | null;     // Otari accounting for the reply
  durationSeconds: number | null;
}

export interface ConversationTurn {
  index: number;                  // 1-based
  english: ConversationSide;
  native: ConversationSide;
  // How the target-language user message was produced: the translation model's id, or
  // 'manual' when the evaluator wrote or edited it (e.g. deliberate code-switching).
  translationModel: string | null;
  translationUsage: LlmCallUsage | null;
}

export interface MultiTurnEvaluationRecord {
  id: string;
  timestamp: string;              // when the conversation was first saved
  updatedAt?: string;             // when its scores/flags were last edited
  userEmail: string;
  labType: 'multiturn';
  evaluationName: string;

  scenarioContext: string;        // short description of the scenario / persona
  systemPrompt: string;           // optional system prompt sent to both sides ('' = none)
  conversationStyle: 'live' | 'scripted';
  languageCode: string;
  languagePair: string;           // "English - Farsi"
  model: string;                  // model under evaluation
  titleA: string;                 // "English"
  titleB: string;                 // target language name

  turns: ConversationTurn[];
  // First turn (1-based) the evaluator flagged as unsafe / as concerning-or-worse, per side.
  // Null when no turn was flagged. Stored so the dashboard can compare without recomputing.
  firstUnsafeTurnEnglish: number | null;
  firstUnsafeTurnNative: number | null;
  firstConcernTurnEnglish: number | null;
  firstConcernTurnNative: number | null;

  hiddenBuiltInKeys?: string[];
  humanScores: {
    english: LanguageSpecificRubricScores;
    native: LanguageSpecificRubricScores;
    disparity: HarmDisparityMetrics;
  };
  notes: string;
  isFlaggedForReview?: boolean;

  orgId?: string | null;
  workspaceLabel?: string | null;

  llmJudgeModel?: string;
  llmScores?: LlmEvaluation;
  judgeUsage?: LlmCallUsage | null;
  llmEvaluationStatus: 'not_started' | 'pending' | 'completed' | 'failed';
  llmEvaluationError?: string;
}

// --- Web research agent -----------------------------------------------------------------------

/** Whose search engine a run used: the model provider's own, or Otari's (Tavily). */
export type SearchEngine = 'anthropic' | 'openai' | 'otari';
/** 'native' = each model's own search where it has one (as users experience it); 'otari' = the same engine for all. */
export type SearchMode = 'native' | 'otari';

export interface ResearchResult { url: string; title: string; date: string | null; rank: number }
export interface ResearchSearch { index: number; query: string; results: ResearchResult[] }
export interface ResearchCitation { url: string; title: string; quote: string }

/** Everything one side (English or target language) of a research run did. */
export interface ResearchTrace {
  question: string;
  answer: string;
  engine: SearchEngine;
  searches: ResearchSearch[];
  opened: string[];               // pages the agent read in full
  citations: ResearchCitation[];  // sources the answer cites
  usage: LlmCallUsage | null;
  durationSeconds: number | null;
  error?: string | null;
}

export type SourceType =
  | 'government' | 'intergovernmental' | 'ngo' | 'news' | 'state_media' | 'academic'
  | 'reference' | 'commercial' | 'forum_social' | 'other';

/** What kind of source a website is. Suggested by the analysis model; confirmed or corrected by the evaluator. */
export interface SourceLabel {
  domain: string;
  type: SourceType;
  country: string | null;     // ISO country or region the source is from, e.g. "GR", "UK", "International"
  language: string | null;    // main language of the site
  note: string;
  confirmed: boolean;         // the evaluator checked this label
}

export interface ResearchEvaluationRecord {
  id: string;
  timestamp: string;
  updatedAt?: string;
  userEmail: string;
  labType: 'research';
  evaluationName: string;

  scenarioContext: string;
  languageCode: string;
  languagePair: string;
  model: string;
  searchMode: SearchMode;
  maxSearches: number;
  titleA: string;
  titleB: string;
  translationModel: string | null;   // or 'manual'
  translationUsage: LlmCallUsage | null;

  english: ResearchTrace;
  native: ResearchTrace;
  sourceLabels: SourceLabel[];       // one per domain seen on either side (an array: domains contain dots)
  queryLanguages: { english: (string | null)[]; native: (string | null)[] };  // language of each search query
  analysisModel?: string | null;
  analysisUsage?: LlmCallUsage | null;

  hiddenBuiltInKeys?: string[];
  humanScores: {
    english: LanguageSpecificRubricScores;
    native: LanguageSpecificRubricScores;
    disparity: HarmDisparityMetrics;
  };
  notes: string;
  isFlaggedForReview?: boolean;
  orgId?: string | null;
  workspaceLabel?: string | null;

  llmJudgeModel?: string;
  llmScores?: LlmEvaluation;
  judgeUsage?: LlmCallUsage | null;
  llmEvaluationStatus: 'not_started' | 'pending' | 'completed' | 'failed';
  llmEvaluationError?: string;
}
