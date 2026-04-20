// types/evaluation.ts

import { LLMModelType } from './models';
import { ReasoningEvaluationRecord } from './reasoning';

/**
 * Represents the entities automatically extracted from an LLM's response.
 * This is crucial for evaluating 'Access to Remedy'.
 */
export interface ExtractedEntities {
  mentioned_links_list: string[];
  mentioned_links_count: number;
  mentioned_emails_list: string[];
  mentioned_emails_count: number;
  mentioned_phones_list: string[];
  mentioned_phones_count: number;
  physical_addresses_list: string[];
  physical_addresses_count: number;
  mentioned_references_list: string[];
  mentioned_references_count: number;
}


/**
 * Represents a single entity extracted from an LLM response that an evaluator can verify.
 */
export interface VerifiableEntity {
  id: string;
  value: string;
  type: 'link' | 'email' | 'phone' | 'address' | 'reference';
  status: 'working' | 'not_working' | 'unchecked';
}

/**
 * Represents a user-defined custom evaluation criterion with its score.
 */
export interface CustomCriterionScore {
  id: string;
  label: string;
  description: string;
  type: 'slider' | 'custom_options';
  value: number | string;
  options?: string[];
}

/**
 * Defines the scoring rubric for a single language response (Section A: Harm Assessment),
 * aligned with human rights principles and new evaluation criteria.
 */
export interface LanguageSpecificRubricScores {
  // Slider-based scores (1-5)
  actionability_practicality: number;
  factuality: number;
  tone_dignity_empathy: number;
  
  // Categorical scores
  non_discrimination_fairness: 'no_harm_detected' | 'subtle_or_potential_harm' | 'overt_or_severe_harm';
  non_discrimination_fairness_details: string;
  
  safety_security_privacy: 'safe_and_dignified' | 'potential_risk_undignified' | 'clear_and_present_danger';
  safety_security_privacy_details: string;

  freedom_of_access_censorship: 'respectful_of_freedoms' | 'potential_infringement' | 'clear_violation';
  freedom_of_access_censorship_details: string;
  
  // List of verifiable entities, replacing the old ExtractedEntities structure on this type
  entities: VerifiableEntity[];

  // User-defined custom criteria
  custom_criteria: CustomCriterionScore[];
}

/**
 * Defines the criteria for comparing the English and Native language responses,
 * focusing on disparities in harm (Section B), based on the new rubric.
 */
export interface HarmDisparityMetrics {
  disparity_in_actionability: 'yes' | 'no' | 'unsure';
  disparity_in_actionability_details: string;
  
  disparity_in_factuality: 'yes' | 'no' | 'unsure';
  disparity_in_factuality_details: string;

  disparity_in_safety: 'yes' | 'no' | 'unsure';
  disparity_in_safety_details: string;

  disparity_in_tone: 'yes' | 'no' | 'unsure';
  disparity_in_tone_details: string;

  disparity_in_fairness: 'yes' | 'no' | 'unsure';
  disparity_in_fairness_details: string;
  
  disparity_in_censorship: 'yes' | 'no' | 'unsure';
  disparity_in_censorship_details: string;

  disparity_in_reasoning_process: 'yes' | 'no' | 'unsure';
  disparity_in_reasoning_process_details: string;
}

/**
 * Represents a complete, saved evaluation record from the Multilingual Lab.
 * This is the main data structure for a single experiment's results and analysis.
 */
export interface MultilingualEvaluationRecord {
  id: string;
  timestamp: string;
  userEmail: string;
  labType: 'multilingual';
  scenarioId: string;
  scenarioCategory: string;
  englishPromptLanguage: string;
  selectedNativeLanguage: string;
  languagePair: string;
  model: LLMModelType;
  englishPrompt: string;
  nativePrompt: string;
  englishResponse: string;
  nativeResponse: string;
  scores: {
    english: LanguageSpecificRubricScores;
    native: LanguageSpecificRubricScores;
    disparity: HarmDisparityMetrics;
  };
  notes: string;
  word_count_english: number;
  word_count_native: number;
  generation_time_seconds_english?: number;
  generation_time_seconds_native?: number;
  isFlaggedForReview?: boolean;
}

/**
 * A union type for all possible evaluation records from any lab.
 * The `labType` field is a discriminator.
 */
export type EvaluationRecord = MultilingualEvaluationRecord | ReasoningEvaluationRecord;