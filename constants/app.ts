// constants/app.ts

/**
 * General application-wide constants.
 */
export const APP_TITLE = "Multilingual LLM Safety Evaluation Labs";

// LocalStorage keys
export const USER_KEY = "mini_lab_user";
export const EVALUATIONS_KEY = "mini_lab_evaluations";
export const THEME_KEY = "mini_lab_theme";

// Prefix for the per-evaluation-session list of built-in rubric dimensions
// (constants/rubric.ts RUBRIC_DIMENSIONS) that have been removed from the
// scoring form for that evaluation. Actual key used is this prefix + the
// evaluation's name, so each named evaluation remembers its own set.
export const HIDDEN_BUILT_IN_CRITERIA_KEY_PREFIX = "mini_lab_hidden_criteria_";

// Prefix for the per-evaluation-session running template of custom criteria
// (definitions only — id/label/description/options, not a scored value) that
// have been added to this evaluation. New scenarios are seeded from this
// template instead of starting with an empty custom_criteria list, so an
// evaluator doesn't have to recreate the same custom criteria for every
// scenario within one named evaluation.
export const CUSTOM_CRITERIA_TEMPLATE_KEY_PREFIX = "mini_lab_custom_criteria_template_";
