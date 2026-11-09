// services/multiTurnAnalytics.ts
//
// Pure functions behind the conversation (multi-turn) dashboard and CSV exports. No React, no
// network, so they can be tested on their own.

import { MultiTurnEvaluationRecord, ConversationTurn, LlmCallUsage, TurnFlag } from '../types';
import { RUBRIC_DIMENSIONS, DISPARITY_CRITERIA, isDimensionVisibleForRecord, isDisparityKeyVisibleForRecord } from '../constants';

export type Side = 'english' | 'native';

// --- Breaking-point outcome per conversation ---------------------------------------------------

export type BreakdownOutcome =
  | 'target-earlier' | 'same-turn' | 'english-earlier' | 'target-only' | 'english-only' | 'neither';

export const OUTCOME_LABELS: Record<BreakdownOutcome, string> = {
  'target-only': 'Only in the target language',
  'target-earlier': 'Earlier in the target language',
  'same-turn': 'Same turn in both',
  'english-earlier': 'Earlier in English',
  'english-only': 'Only in English',
  'neither': 'No concerns in either',
};
export const OUTCOME_ORDER: BreakdownOutcome[] = ['target-only', 'target-earlier', 'same-turn', 'english-earlier', 'english-only', 'neither'];

const isConcern = (f: TurnFlag | null) => f === 'concerning' || f === 'unsafe';

/** First turn (1-based) flagged concerning or worse, recomputed from the turns themselves. */
export const firstConcernTurn = (r: MultiTurnEvaluationRecord, side: Side): number | null =>
  r.turns.find(t => isConcern(t[side].flag))?.index ?? null;
export const firstUnsafeTurn = (r: MultiTurnEvaluationRecord, side: Side): number | null =>
  r.turns.find(t => t[side].flag === 'unsafe')?.index ?? null;

export const breakdownOutcome = (r: MultiTurnEvaluationRecord): BreakdownOutcome => {
  const en = firstConcernTurn(r, 'english');
  const tg = firstConcernTurn(r, 'native');
  if (en == null && tg == null) return 'neither';
  if (en == null) return 'target-only';
  if (tg == null) return 'english-only';
  return tg < en ? 'target-earlier' : tg > en ? 'english-earlier' : 'same-turn';
};

// --- Cost and tokens --------------------------------------------------------------------------

const num = (x: number | null | undefined) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const sumCost = (us: (LlmCallUsage | null | undefined)[]) => us.reduce((a, u) => a + num(u?.costUsd), 0);

export const conversationCosts = (r: MultiTurnEvaluationRecord) => {
  const english = sumCost(r.turns.map(t => t.english.usage));
  const native = sumCost(r.turns.map(t => t.native.usage));
  const translation = sumCost(r.turns.map(t => t.translationUsage));
  const judge = num(r.judgeUsage?.costUsd);
  return { english, native, translation, judge, total: english + native + translation + judge };
};

export const hasCostData = (r: MultiTurnEvaluationRecord) =>
  r.turns.some(t => t.english.usage?.costUsd != null || t.native.usage?.costUsd != null);

// --- Aggregates -------------------------------------------------------------------------------

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * For each turn number: among conversations that reached that turn, the share of replies
 * flagged concerning or unsafe, per side. Unflagged replies count as not concerning (the
 * scoring screen says so too).
 */
export const concernRateByTurn = (records: MultiTurnEvaluationRecord[]) => {
  const maxTurn = Math.max(0, ...records.map(r => r.turns.length));
  return Array.from({ length: maxTurn }, (_, i) => {
    const turn = i + 1;
    const at = records.map(r => r.turns[i]).filter((t): t is ConversationTurn => !!t);
    const rate = (side: Side) => (at.length ? at.filter(t => isConcern(t[side].flag)).length / at.length : null);
    const tokens = (side: Side) => mean(at.map(t => t[side].usage?.promptTokens).filter((x): x is number => typeof x === 'number'));
    return { turn, n: at.length, english: rate('english'), native: rate('native'), inputTokensEnglish: tokens('english'), inputTokensNative: tokens('native') };
  });
};

/** Summary for a group of conversations (a language, a model, or everything). */
export const summarize = (records: MultiTurnEvaluationRecord[]) => {
  const n = records.length;
  const pct = (pred: (r: MultiTurnEvaluationRecord) => boolean) => (n ? records.filter(pred).length / n : null);
  const firstConcerns = (side: Side) => records.map(r => firstConcernTurn(r, side)).filter((x): x is number => x != null);
  const outcomes = OUTCOME_ORDER.reduce((acc, o) => ({ ...acc, [o]: 0 }), {} as Record<BreakdownOutcome, number>);
  records.forEach(r => { outcomes[breakdownOutcome(r)] += 1; });
  const costed = records.filter(hasCostData);
  return {
    n,
    avgTurns: mean(records.map(r => r.turns.length)),
    concernRateEnglish: pct(r => firstConcernTurn(r, 'english') != null),
    concernRateNative: pct(r => firstConcernTurn(r, 'native') != null),
    unsafeRateEnglish: pct(r => firstUnsafeTurn(r, 'english') != null),
    unsafeRateNative: pct(r => firstUnsafeTurn(r, 'native') != null),
    medianFirstConcernEnglish: median(firstConcerns('english')),
    medianFirstConcernNative: median(firstConcerns('native')),
    outcomes,
    targetWorse: outcomes['target-only'] + outcomes['target-earlier'],
    englishWorse: outcomes['english-only'] + outcomes['english-earlier'],
    avgCostEnglish: mean(costed.map(r => conversationCosts(r).english)),
    avgCostNative: mean(costed.map(r => conversationCosts(r).native)),
    totalCost: records.reduce((a, r) => a + conversationCosts(r).total, 0),
  };
};

export const groupBy = <K extends string>(records: MultiTurnEvaluationRecord[], key: (r: MultiTurnEvaluationRecord) => K) => {
  const m = new Map<K, MultiTurnEvaluationRecord[]>();
  records.forEach(r => { const k = key(r); m.set(k, [...(m.get(k) ?? []), r]); });
  return Array.from(m.entries());
};

// --- Human vs judge ---------------------------------------------------------------------------

/**
 * Per built-in dimension and side: the human's and the judge's average. Sliders are 1-5
 * averages; categorical dimensions are the share of conversations rated anything other than
 * the best option (i.e. "some harm"). Only completed judge results, and only dimensions
 * that were part of each record's form.
 */
// Works for any record type that has human and judge scores (conversations, research runs…).
type Judged = Pick<MultiTurnEvaluationRecord, 'llmEvaluationStatus' | 'llmScores' | 'hiddenBuiltInKeys' | 'humanScores'>;
export const humanVsJudge = <R extends Judged>(records: R[]) => {
  const judged = records.filter(r => r.llmEvaluationStatus === 'completed' && r.llmScores);
  return RUBRIC_DIMENSIONS.map(dim => {
    const best = dim.options?.[0]?.value;
    const rows: R[] = judged.filter(r => isDimensionVisibleForRecord(r.hiddenBuiltInKeys, dim.key));
    const val = (v: unknown): number | null =>
      dim.isSlider ? (typeof v === 'number' ? v : null) : (typeof v === 'string' ? (v === best ? 0 : 1) : null);
    const avg = (pick: (r: R) => unknown) =>
      mean(rows.map(r => val(pick(r))).filter((x): x is number => x != null));
    const k = dim.key as string;
    return {
      key: k, label: dim.label, isSlider: !!dim.isSlider, n: rows.length,
      humanEnglish: avg(r => (r.humanScores.english as any)[k]),
      judgeEnglish: avg(r => (r.llmScores!.english as any)[k]),
      humanNative: avg(r => (r.humanScores.native as any)[k]),
      judgeNative: avg(r => (r.llmScores!.native as any)[k]),
    };
  }).filter(d => d.n > 0);
};

// --- CSV --------------------------------------------------------------------------------------

const csvCell = (v: unknown): string => {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180 CSV with a UTF-8 BOM, so Excel shows Farsi, Amharic, etc. correctly. */
export const toCsv = (rows: Record<string, unknown>[]): string => {
  const headers: string[] = [];
  rows.forEach(r => Object.keys(r).forEach(h => { if (!headers.includes(h)) headers.push(h); }));
  const lines = [headers.map(csvCell).join(','), ...rows.map(r => headers.map(h => csvCell(r[h])).join(','))];
  return '﻿' + lines.join('\r\n');
};

const scoreColumns = (prefix: string, scores: any, r: MultiTurnEvaluationRecord) => {
  const out: Record<string, unknown> = {};
  if (!scores) return out;
  RUBRIC_DIMENSIONS.forEach(dim => {
    if (!isDimensionVisibleForRecord(r.hiddenBuiltInKeys, dim.key)) return;
    out[`${prefix}_${dim.key}`] = scores[dim.key];
    const details = scores[`${dim.key}_details`];
    if (typeof details === 'string' && details) out[`${prefix}_${dim.key}_details`] = details;
  });
  (scores.custom_criteria ?? []).forEach((c: any) => {
    out[`${prefix}_custom_${c.label}`] = c.value;
    if (c.details) out[`${prefix}_custom_${c.label}_details`] = c.details;
  });
  return out;
};

const disparityColumns = (prefix: string, d: any, r: MultiTurnEvaluationRecord) => {
  const out: Record<string, unknown> = {};
  if (!d) return out;
  DISPARITY_CRITERIA.forEach(c => {
    if (c.key === 'disparity_in_reasoning_process' || !isDisparityKeyVisibleForRecord(r.hiddenBuiltInKeys, c.key)) return;
    out[`${prefix}_${c.key}`] = d[c.key];
    if (d[c.detailsKey]) out[`${prefix}_${c.key}_details`] = d[c.detailsKey];
  });
  (d.custom_disparities ?? []).forEach((c: any) => { out[`${prefix}_custom_disparity_${c.label}`] = c.value; });
  return out;
};

const money = (x: number) => Number(x.toFixed(6));

/** One row per conversation: setup, breaking points, costs, human and judge scores. */
export const conversationRows = (records: MultiTurnEvaluationRecord[]) => records.map(r => {
  const c = conversationCosts(r);
  return {
    conversation_id: r.id, timestamp: r.timestamp, updated_at: r.updatedAt ?? '', evaluator: r.userEmail, evaluation_name: r.evaluationName,
    scenario: r.scenarioContext, language_pair: r.languagePair, language_code: r.languageCode, model: r.model,
    conversation_style: r.conversationStyle, system_prompt: r.systemPrompt, turns: r.turns.length,
    first_concern_turn_english: firstConcernTurn(r, 'english'), first_concern_turn_target: firstConcernTurn(r, 'native'),
    first_unsafe_turn_english: firstUnsafeTurn(r, 'english'), first_unsafe_turn_target: firstUnsafeTurn(r, 'native'),
    breakdown_outcome: OUTCOME_LABELS[breakdownOutcome(r)],
    cost_usd_english: money(c.english), cost_usd_target: money(c.native), cost_usd_translation: money(c.translation),
    cost_usd_judge: money(c.judge), cost_usd_total: money(c.total),
    judge_model: r.llmJudgeModel ?? '', judge_status: r.llmEvaluationStatus, judge_error: r.llmEvaluationError ?? '', judge_notes: r.llmScores?.notes ?? '',
    human_notes: r.notes, flagged_for_review: !!r.isFlaggedForReview, org_id: r.orgId ?? '', workspace: r.workspaceLabel ?? '',
    ...scoreColumns('human_english', r.humanScores?.english, r),
    ...scoreColumns('human_target', r.humanScores?.native, r),
    ...disparityColumns('human', r.humanScores?.disparity, r),
    ...scoreColumns('judge_english', r.llmScores?.english, r),
    ...scoreColumns('judge_target', r.llmScores?.native, r),
    ...disparityColumns('judge', r.llmScores?.disparity, r),
  };
});

/** One row per turn: both user messages, both replies, flags, notes, tokens and cost. */
export const turnRows = (records: MultiTurnEvaluationRecord[]) => records.flatMap(r => r.turns.map(t => ({
  conversation_id: r.id, evaluation_name: r.evaluationName, scenario: r.scenarioContext, language_pair: r.languagePair, model: r.model,
  turn: t.index, translation: t.translationModel ?? '',
  user_english: t.english.user, user_target: t.native.user,
  reply_english: t.english.assistant, reply_target: t.native.assistant,
  flag_english: t.english.flag ?? '', flag_target: t.native.flag ?? '',
  note_english: t.english.note, note_target: t.native.note,
  input_tokens_english: t.english.usage?.promptTokens ?? '', input_tokens_target: t.native.usage?.promptTokens ?? '',
  output_tokens_english: t.english.usage?.completionTokens ?? '', output_tokens_target: t.native.usage?.completionTokens ?? '',
  cost_usd_english: t.english.usage?.costUsd ?? '', cost_usd_target: t.native.usage?.costUsd ?? '',
  cost_usd_translation: t.translationUsage?.costUsd ?? '',
  seconds_english: t.english.durationSeconds ?? '', seconds_target: t.native.durationSeconds ?? '',
  provider_english: t.english.usage?.provider ?? '', provider_target: t.native.usage?.provider ?? '',
  fallback_english: !!t.english.usage?.fallback, fallback_target: !!t.native.usage?.fallback,
})));

export const downloadCsv = (filename: string, csv: string) => {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Human vs judge on the evaluator's OWN criteria (custom_criteria), matched by criterion label.
 * Option criteria: share of runs where the judge picked the same option as the human, per side.
 * Slider criteria: the two averages. Only completed judge results.
 */
export const customCriteriaAgreement = <R extends Judged>(records: R[]) => {
  const judged = records.filter(r => r.llmEvaluationStatus === 'completed' && r.llmScores);
  const labels = Array.from(new Set(judged.flatMap(r => (r.humanScores.english.custom_criteria ?? []).map(c => c.label))));
  return labels.map(label => {
    const pairs = (side: 'english' | 'native') => judged.map(r => {
      const h = (r.humanScores[side].custom_criteria ?? []).find(c => c.label === label);
      const j = ((r.llmScores![side] as any).custom_criteria ?? []).find((c: any) => c.label === label);
      return h && j ? { h: h.value, j: j.value, type: h.type } : null;
    }).filter(<T,>(x: T | null): x is T => !!x);
    const en = pairs('english'), na = pairs('native');
    const isSlider = [...en, ...na].some(p => p.type === 'slider');
    const agree = (ps: typeof en) => (ps.length ? ps.filter(p => String(p.h) === String(p.j)).length / ps.length : null);
    const avg = (ps: typeof en, k: 'h' | 'j') => mean(ps.map(p => Number(p[k])).filter(Number.isFinite));
    return {
      label, isSlider, n: Math.max(en.length, na.length),
      agreementEnglish: isSlider ? null : agree(en), agreementNative: isSlider ? null : agree(na),
      humanEnglish: isSlider ? avg(en, 'h') : null, judgeEnglish: isSlider ? avg(en, 'j') : null,
      humanNative: isSlider ? avg(na, 'h') : null, judgeNative: isSlider ? avg(na, 'j') : null,
    };
  }).filter(x => x.n > 0);
};
