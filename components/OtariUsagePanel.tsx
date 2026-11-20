import React, { useMemo } from 'react';
import { ReasoningEvaluationRecord, LlmCallUsage } from '../types';
import { getModelDisplayName, classifyModelLicense } from '../constants';

/**
 * Cost, token and routing analytics from the per-call usage Otari reports (tokens, usage.cost_usd,
 * provider, fallback). Answers the question: does asking the SAME question in a non-English
 * language cost more — the "tokenization tax" paid by speakers of under-served languages?
 */

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);
const fmtUsd = (v: number | null, digits = 4) => (v == null ? '—' : `$${v.toFixed(digits)}`);
const fmtNum = (v: number | null, digits = 0) => (v == null ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }));
const fmtRatio = (v: number | null) => (v == null ? '—' : `${v.toFixed(2)}×`);
const ratio = (a: number | null, b: number | null) => (a != null && b != null && a > 0 ? b / a : null);

const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
const callsOf = (e: ReasoningEvaluationRecord): LlmCallUsage[] =>
  [e.usageA, e.usageB, e.translationUsage, e.judgeUsage].filter((u): u is LlmCallUsage => !!u);

const Tile: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="bg-background p-4 rounded-lg border border-border/70 shadow-sm">
    <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
    <div className="text-sm text-muted-foreground">{label}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
  </div>
);

const Th: React.FC<{ children: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);
const Td: React.FC<{ children: React.ReactNode; right?: boolean; strong?: boolean }> = ({ children, right, strong }) => (
  <td className={`px-3 py-2 text-sm ${right ? 'text-right tabular-nums' : ''} ${strong ? 'font-semibold text-foreground' : 'text-card-foreground'}`}>{children}</td>
);

const OtariUsagePanel: React.FC<{ evaluations: ReasoningEvaluationRecord[] }> = ({ evaluations }) => {
  const data = useMemo(() => {
    const paired = evaluations.filter(e => e.usageA && e.usageB);
    const allCalls = evaluations.flatMap(callsOf);
    if (allCalls.length === 0) return null;

    const totalCost = sum(nums(allCalls.map(c => c.costUsd)));
    const costedCalls = allCalls.filter(c => c.costUsd != null).length;
    const fallbackCalls = allCalls.filter(c => c.fallback).length;

    const perExperimentCost = mean(nums(evaluations.filter(e => callsOf(e).some(c => c.costUsd != null)).map(e => sum(nums(callsOf(e).map(c => c.costUsd))))));

    // Input-token ratio for the same prompt: target language ÷ English. >1 means the
    // non-English user pays more context (and money) to ask the same question.
    const inputRatios = nums(paired.map(e => ratio(e.usageA!.promptTokens, e.usageB!.promptTokens)));
    const avgInputRatio = mean(inputRatios);

    const roles: { key: LlmCallUsage['role']; label: string }[] = [
      { key: 'evaluated', label: 'Model under evaluation' },
      { key: 'translation', label: 'Translation' },
      { key: 'judge', label: 'LLM-as-a-judge' },
    ];
    const byRole = roles.map(r => {
      const calls = allCalls.filter(c => c.role === r.key);
      const cost = sum(nums(calls.map(c => c.costUsd)));
      return {
        label: r.label,
        calls: calls.length,
        tokens: sum(nums(calls.map(c => c.totalTokens))),
        cost,
        share: totalCost > 0 ? cost / totalCost : null,
      };
    });

    const groupBy = <K extends string>(items: ReasoningEvaluationRecord[], key: (e: ReasoningEvaluationRecord) => K) => {
      const m = new Map<K, ReasoningEvaluationRecord[]>();
      items.forEach(e => { const k = key(e); m.set(k, [...(m.get(k) ?? []), e]); });
      return Array.from(m.entries());
    };

    const byLanguage = groupBy(paired, e => e.titleB || 'Unknown').map(([language, rows]) => {
      const inA = mean(nums(rows.map(e => e.usageA!.promptTokens)));
      const inB = mean(nums(rows.map(e => e.usageB!.promptTokens)));
      const outA = mean(nums(rows.map(e => e.usageA!.completionTokens)));
      const outB = mean(nums(rows.map(e => e.usageB!.completionTokens)));
      const costA = mean(nums(rows.map(e => e.usageA!.costUsd)));
      const costB = mean(nums(rows.map(e => e.usageB!.costUsd)));
      return { language, n: rows.length, inA, inB, inRatio: ratio(inA, inB), outA, outB, costA, costB, costRatio: ratio(costA, costB) };
    }).sort((a, b) => (b.inRatio ?? 0) - (a.inRatio ?? 0));

    const byModel = groupBy(paired, e => e.model).map(([model, rows]) => {
      const costA = mean(nums(rows.map(e => e.usageA!.costUsd)));
      const costB = mean(nums(rows.map(e => e.usageB!.costUsd)));
      const latA = mean(nums(rows.map(e => e.usageA!.durationMs)));
      const latB = mean(nums(rows.map(e => e.usageB!.durationMs)));
      const inRatio = mean(nums(rows.map(e => ratio(e.usageA!.promptTokens, e.usageB!.promptTokens))));
      const fallbacks = rows.filter(e => e.usageA!.fallback || e.usageB!.fallback).length;
      return { model, n: rows.length, costA, costB, latA, latB, inRatio, fallbackRate: rows.length ? fallbacks / rows.length : null };
    }).sort((a, b) => (a.costB ?? Infinity) - (b.costB ?? Infinity));

    return { totalCost, costedCalls, allCalls: allCalls.length, fallbackCalls, perExperimentCost, avgInputRatio, byRole, byLanguage, byModel, pairedCount: paired.length };
  }, [evaluations]);

  return (
    <div className="bg-card text-card-foreground p-6 rounded-xl shadow-md border border-border">
      <div className="border-b border-border mb-4 pb-3">
        <h3 className="text-lg font-semibold text-foreground">Cost &amp; Efficiency (via Otari)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Tokens, cost and provider routing reported by Otari for every call — the model under evaluation, the translation model and the LLM judge.
          The <em>input-token ratio</em> compares the same prompt in the target language vs. English: above 1× means speakers of that language pay more to ask the same question.
        </p>
      </div>

      {!data ? (
        <p className="text-sm text-muted-foreground italic">No Otari usage recorded in this view yet. Evaluations run after the Otari integration record tokens and cost automatically.</p>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Total spend in view" value={fmtUsd(data.totalCost, 2)} hint={`${data.costedCalls} of ${data.allCalls} calls priced by Otari`} />
            <Tile label="Avg. cost per experiment" value={fmtUsd(data.perExperimentCost)} hint="2 answers + translation + judge" />
            <Tile label="Avg. input-token ratio" value={fmtRatio(data.avgInputRatio)} hint={`target language ÷ English, ${data.pairedCount} experiments`} />
            <Tile label="Calls served by fallback" value={data.allCalls ? `${((data.fallbackCalls / data.allCalls) * 100).toFixed(1)}%` : '—'} hint="Otari re-routed to another provider" />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Spend by role</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead><tr><Th>Role</Th><Th right>Calls</Th><Th right>Tokens</Th><Th right>Cost</Th><Th right>Share</Th></tr></thead>
                <tbody className="divide-y divide-border/60">
                  {data.byRole.map(r => (
                    <tr key={r.label}>
                      <Td strong>{r.label}</Td>
                      <Td right>{fmtNum(r.calls)}</Td>
                      <Td right>{fmtNum(r.tokens)}</Td>
                      <Td right>{fmtUsd(r.cost)}</Td>
                      <Td right>{r.share == null ? '—' : `${(r.share * 100).toFixed(0)}%`}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.byLanguage.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Same question, different language — per target language</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead><tr>
                    <Th>Language</Th><Th right>n</Th>
                    <Th right>Input tokens EN</Th><Th right>Input tokens target</Th><Th right>Input ratio</Th>
                    <Th right>Output tokens EN</Th><Th right>Output tokens target</Th>
                    <Th right>Cost EN</Th><Th right>Cost target</Th><Th right>Cost ratio</Th>
                  </tr></thead>
                  <tbody className="divide-y divide-border/60">
                    {data.byLanguage.map(l => (
                      <tr key={l.language}>
                        <Td strong>{l.language}</Td>
                        <Td right>{l.n}</Td>
                        <Td right>{fmtNum(l.inA)}</Td><Td right>{fmtNum(l.inB)}</Td><Td right strong>{fmtRatio(l.inRatio)}</Td>
                        <Td right>{fmtNum(l.outA)}</Td><Td right>{fmtNum(l.outB)}</Td>
                        <Td right>{fmtUsd(l.costA, 5)}</Td><Td right>{fmtUsd(l.costB, 5)}</Td><Td right strong>{fmtRatio(l.costRatio)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.byModel.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Per model under evaluation</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead><tr>
                    <Th>Model</Th><Th>Weights</Th><Th right>n</Th>
                    <Th right>Cost EN</Th><Th right>Cost target</Th>
                    <Th right>Latency EN</Th><Th right>Latency target</Th>
                    <Th right>Input ratio</Th><Th right>Fallback</Th>
                  </tr></thead>
                  <tbody className="divide-y divide-border/60">
                    {data.byModel.map(m => {
                      const license = classifyModelLicense(m.model);
                      return (
                        <tr key={m.model}>
                          <Td strong>{getModelDisplayName(m.model)}</Td>
                          <Td>{license === 'open-weight' ? 'Open' : license === 'proprietary' ? 'Proprietary' : '—'}</Td>
                          <Td right>{m.n}</Td>
                          <Td right>{fmtUsd(m.costA, 5)}</Td><Td right>{fmtUsd(m.costB, 5)}</Td>
                          <Td right>{m.latA == null ? '—' : `${(m.latA / 1000).toFixed(1)}s`}</Td>
                          <Td right>{m.latB == null ? '—' : `${(m.latB / 1000).toFixed(1)}s`}</Td>
                          <Td right>{fmtRatio(m.inRatio)}</Td>
                          <Td right>{m.fallbackRate == null ? '—' : `${(m.fallbackRate * 100).toFixed(0)}%`}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OtariUsagePanel;
