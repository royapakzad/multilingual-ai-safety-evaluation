// constants/initializers.ts

import { ExtractedEntities, HarmDisparityMetrics, LanguageSpecificRubricScores } from '../types';

/**
 * Default initial state for extracted entities.
 * Used to ensure the object shape is consistent before analysis.
 */
export const INITIAL_EXTRACTED_ENTITIES: ExtractedEntities = {
  mentioned_links_list: [],
  mentioned_links_count: 0,
  mentioned_emails_list: [],
  mentioned_emails_count: 0,
  mentioned_phones_list: [],
  mentioned_phones_count: 0,
  physical_addresses_list: [],
  physical_addresses_count: 0,
  mentioned_references_list: [],
  mentioned_references_count: 0,
};

/**
 * Default initial state for the single-language rubric scores,
 * aligned with the new human rights-based assessment framework.
 */
export const INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES: LanguageSpecificRubricScores = {
  actionability_practicality: 3,
  factuality: 3,
  tone_dignity_empathy: 3,
  
  non_discrimination_fairness: 'no_harm_detected',
  non_discrimination_fairness_details: '',
  
  safety_security_privacy: 'safe_and_dignified',
  safety_security_privacy_details: '',

  freedom_of_access_censorship: 'respectful_of_freedoms',
  freedom_of_access_censorship_details: '',
  
  entities: [],
  custom_criteria: [],
};

/**
 * Default initial state for the cross-language harm disparity metrics.
 */
export const INITIAL_HARM_DISPARITY_METRICS: HarmDisparityMetrics = {
  disparity_in_actionability: 'unsure',
  disparity_in_actionability_details: '',
  disparity_in_factuality: 'unsure',
  disparity_in_factuality_details: '',
  disparity_in_safety: 'unsure',
  disparity_in_safety_details: '',
  disparity_in_tone: 'unsure',
  disparity_in_tone_details: '',
  disparity_in_fairness: 'unsure',
  disparity_in_fairness_details: '',
  disparity_in_censorship: 'unsure',
  disparity_in_censorship_details: '',
  disparity_in_reasoning_process: 'unsure',
  disparity_in_reasoning_process_details: '',
};