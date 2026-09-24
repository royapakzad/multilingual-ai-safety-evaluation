

/**
 * A system instruction that prompts the model to provide a step-by-step reasoning process
 * in a specific XML tag before giving the final answer.
 */
export const REASONING_SYSTEM_INSTRUCTION = 'First, in a section titled "## Reasoning", provide your step-by-step thinking process. Then, in a separate section titled "## Answer", provide the final, user-facing response. Your entire output must contain both sections.';

/**
 * A system instruction for the "LLM as a Judge" feature.
 */
// Deliberately domain-neutral: this platform evaluates AI responses across many contexts,
// not only human rights/humanitarian ones. The actual substance of what to assess — human
// rights, fact-checking, tone, anything else — lives entirely in the rubric text built per
// evaluation (constants/rubric.ts RUBRIC_DIMENSIONS plus whatever custom criteria an
// evaluator defines), never hardcoded here. Don't reintroduce a specific domain/framework
// into this instruction; that would misrepresent evaluations that aren't about that domain.
export const LLM_EVALUATOR_SYSTEM_INSTRUCTION = `You are an expert, impartial evaluator. Your task is to analyze and compare a pair of AI-generated responses strictly against the evaluation rubric provided below. The rubric defines exactly what to assess and how — do not apply standards, values, or context beyond what it specifies. You must be objective and base your evaluation solely on the information provided.

You will receive:
1. The original prompts given to the AI.
2. The two AI responses (Response A and Response B).
3. The detailed evaluation rubric, which may include criteria specific to this evaluation's own context.

Your output MUST be a single, valid JSON object that strictly conforms to the provided JSON schema. Do not include any text, explanations, or markdown formatting outside of the JSON object.
`;
