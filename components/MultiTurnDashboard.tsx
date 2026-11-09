import React, { useMemo, useState } from 'react';
import { MultiTurnEvaluationRecord } from '../types';
import { getModelDisplayName, classifyModelLicense } from '../constants';
import {
  summarize, concernRateByTurn, groupBy, humanVsJudge, customCriteriaAgreement, OUTCOME_LABELS, OUTCOME_ORDER,
  toCsv, conversationRows, turnRows, downloadCsv,
} from '../services/multiTurnAnalytics';

/**
 * Dashboard for conversation (multi-turn) evaluations: where conversations break down, in
 * which language first, per language and per model, human vs judge, and Otari cost.
 *
 * Colour: English and the target language are the only two series anywhere on this page and
 * always use the same two validated categorical slots (blue = English, orange = target),
 * with a legend and direct labels so identity never depends on colour alone.
 */

const SERIES = { english: '#2a78d6', native: '#eb6834' };
const INK = { primary: '#111827', secondary: '#4b5563', muted: '#6b7280', grid: '#e5e7eb', bar: '#6b7280' };

const pct = (v: number | null, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
const usd = (v: number | null, d = 4) => (v == null ? '—' : `$${v.toFixed(d)}`);
const num = (v: number | null, d = 1) => (v == null ? '—' : v.toFixed(d));
const ratio = (a: number | null, b: number | null) => (a != null && b != null && a > 0 ? `${(b / a).toFixed(2)}×` : '—');

const Card: React.FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, actions, children }) => (
  <section className="bg-card border border-border rounded-xl p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{subtitle}</p>}
      </div>
      {actions}
    </div>
    {children}
  </section>
);

const Tile: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode }> = ({ label, value, hint }) => (
  <div className="bg-card border border-border rounded-xl px-4 py-3.5">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="text-2xl font-semibold text-foreground tabular-nums mt-1">{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
  </div>
);

const LegendKey: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
    <span className="inline-block w-3 h-[3px] rounded-full" style={{ background: color }} />{label}
  </span>
);

const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th scope="col" className={`px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);
const Td: React.FC<{ children?: React.ReactNode; right?: boolean; strong?: boolean }> = ({ children, right, strong }) => (
  <td className={`px-3 py-2 text-sm whitespace-nowrap ${right ? 'text-right tabular-nums' : ''} ${strong ? 'font-medium text-foreground' : 'text-card-foreground'}`}>{children}</td>
);
const Table: React.FC<{ head: React.ReactNode; children: React.ReactNode }> = ({ head, children }) => (
  <div className="overflow-x-auto -mx-1">
    <table className="min-w-full"><thead className="border-b border-border"><tr>{head}</tr></thead>
      <tbody className="divide-y divide-border">{children}</tbody></table>
  </div>
);

// --- Line chart: concern rate by turn ---------------------------------------------------------

const ConcernByTurnChart: React.FC<{ data: ReturnType<typeof concernRateByTurn>; titleB: string }> = ({ data, titleB }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 260, m = { t: 16, r: 92, b: 36, l: 44 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const maxTurn = Math.max(1, data.length);
  const x = (turn: number) => m.l + (maxTurn === 1 ? iw / 2 : ((turn - 1) / (maxTurn - 1)) * iw);
  const y = (v: number) => m.t + ih - v * ih;
  const path = (side: 'english' | 'native') =>
    data.filter(d => d[side] != null).map((d, i) => `${i ? 'L' : 'M'}${x(d.turn)},${y(d[side]!)}`).join(' ');
  const last = (side: 'english' | 'native') => [...data].reverse().find(d => d[side] != null);
  const lastEn = last('english'), lastNa = last('native');
  // Keep the two end labels from colliding
  let yEn = lastEn ? y(lastEn.english!) : 0, yNa = lastNa ? y(lastNa.native!) : 0;
  if (Math.abs(yEn - yNa) < 14) { const mid = (yEn + yNa) / 2, enAbove = yEn <= yNa; yEn = mid + (enAbove ? -8 : 8); yNa = mid + (enAbove ? 8 : -8); }
  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[300px]" role="img"
        aria-label={`Share of replies flagged concerning or unsafe at each turn, English vs ${titleB}`}
        onMouseLeave={() => setHover(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <g key={v}>
            <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} stroke={INK.grid} strokeWidth={1} />
            <text x={m.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={INK.muted}>{v * 100}%</text>
          </g>
        ))}
        {data.map(d => (
          <text key={d.turn} x={x(d.turn)} y={H - m.b + 18} textAnchor="middle" fontSize={11} fill={INK.muted}>{d.turn}</text>
        ))}
        <text x={m.l + iw / 2} y={H - 4} textAnchor="middle" fontSize={11} fill={INK.muted}>Turn</text>
        {h && <line x1={x(h.turn)} x2={x(h.turn)} y1={m.t} y2={m.t + ih} stroke={INK.secondary} strokeWidth={1} strokeDasharray="3 3" />}
        {(['english', 'native'] as const).map(side => (
          <g key={side}>
            <path d={path(side)} fill="none" stroke={SERIES[side]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {data.map(d => d[side] != null && (
              <circle key={d.turn} cx={x(d.turn)} cy={y(d[side]!)} r={hover === d.turn - 1 ? 5 : 4} fill={SERIES[side]} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        ))}
        {lastEn && <text x={x(lastEn.turn) + 10} y={yEn} dominantBaseline="middle" fontSize={12} fill={INK.primary}>English</text>}
        {lastNa && <text x={x(lastNa.turn) + 10} y={yNa} dominantBaseline="middle" fontSize={12} fill={INK.primary}>{titleB.length > 12 ? `${titleB.slice(0, 11)}…` : titleB}</text>}
        {/* Hover targets: one full-height band per turn, wider than the marks */}
        {data.map((d, i) => (
          <rect key={d.turn} x={x(d.turn) - iw / Math.max(2, maxTurn * 2)} y={m.t} width={iw / Math.max(1, maxTurn)} height={ih}
            fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-2 bg-popover border border-border rounded-lg shadow-md px-3 py-2 text-xs"
          style={{ left: `${(x(h.turn) / W) * 100}%`, transform: x(h.turn) > W * 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}>
          <div className="font-semibold text-foreground mb-1">Turn {h.turn} · {h.n} {h.n === 1 ? 'conversation' : 'conversations'}</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: SERIES.english }} />English <span className="ml-auto tabular-nums text-foreground">{pct(h.english)}</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: SERIES.native }} />{titleB} <span className="ml-auto pl-3 tabular-nums text-foreground">{pct(h.native)}</span></div>
        </div>
      )}
    </div>
  );
};

// --- Horizontal bars: breakdown outcomes ------------------------------------------------------

const OutcomeBars: React.FC<{ outcomes: Record<string, number>; total: number; titleB: string }> = ({ outcomes, total, titleB }) => {
  const max = Math.max(1, ...Object.values(outcomes));
  return (
    <ul className="space-y-2.5">
      {OUTCOME_ORDER.map(o => {
        const v = outcomes[o] ?? 0;
        const label = OUTCOME_LABELS[o].replace('the target language', titleB);
        return (
          <li key={o} className="grid grid-cols-[minmax(0,13rem)_1fr_4.5rem] items-center gap-3 text-sm" title={`${label}: ${v} of ${total}`}>
            <span className="text-foreground truncate">{label}</span>
            <span className="h-3 bg-muted rounded-[4px] overflow-hidden">
              <span className="block h-full rounded-[4px]" style={{ width: `${(v / max) * 100}%`, background: INK.bar }} />
            </span>
            <span className="text-right tabular-nums text-muted-foreground">{v} <span className="text-xs">({pct(total ? v / total : null)})</span></span>
          </li>
        );
      })}
    </ul>
  );
};

// --- Main -------------------------------------------------------------------------------------

const MultiTurnDashboard: React.FC<{ records: MultiTurnEvaluationRecord[]; evaluationName: string }> = ({ records, evaluationName }) => {
  const [language, setLanguage] = useState('');
  const [model, setModel] = useState('');
  const [judge, setJudge] = useState('');
  const [showChartTable, setShowChartTable] = useState(false);

  const languages = useMemo(() => Array.from(new Set(records.map(r => r.titleB))).sort(), [records]);
  const models = useMemo(() => Array.from(new Set(records.map(r => r.model))).sort(), [records]);
  const judges = useMemo(() => Array.from(new Set(records.map(r => r.llmJudgeModel).filter(Boolean) as string[])).sort(), [records]);

  const filtered = useMemo(() => records.filter(r =>
    (!language || r.titleB === language) && (!model || r.model === model) && (!judge || r.llmJudgeModel === judge)), [records, language, model, judge]);

  const all = useMemo(() => summarize(filtered), [filtered]);
  const byTurn = useMemo(() => concernRateByTurn(filtered), [filtered]);
  const byLanguage = useMemo(() => groupBy(filtered, r => r.titleB).map(([k, rs]) => ({ key: k, ...summarize(rs) })).sort((a, b) => b.n - a.n), [filtered]);
  const byModel = useMemo(() => groupBy(filtered, r => r.model).map(([k, rs]) => ({ key: k, ...summarize(rs) })).sort((a, b) => b.n - a.n), [filtered]);
  const hvj = useMemo(() => humanVsJudge(filtered), [filtered]);
  const cca = useMemo(() => customCriteriaAgreement(filtered), [filtered]);
  const titleB = language || (languages.length === 1 ? languages[0] : 'Target language');

  const slug = evaluationName.replace(/[^\w-]+/g, '_').slice(0, 40) || 'evaluation';
  const stamp = new Date().toISOString().slice(0, 10);
  const exportConversations = () => downloadCsv(`${slug}_conversations_${stamp}.csv`, toCsv(conversationRows(filtered)));
  const exportTurns = () => downloadCsv(`${slug}_turns_${stamp}.csv`, toCsv(turnRows(filtered)));

  const selectCls = 'w-full p-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring';
  const btn = 'px-3.5 py-2 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 transition-colors';

  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground">The dashboard fills in once you have saved a conversation.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Filters + export, in one row above everything */}
      <div className="flex flex-wrap items-end gap-3">
        {([['Language', language, setLanguage, languages, (v: string) => v],
           ['Model under evaluation', model, setModel, models, getModelDisplayName],
           ['Judge model', judge, setJudge, judges, getModelDisplayName]] as const).map(([label, value, set, options, fmt]) => (
          <label key={label} className="min-w-[12rem] flex-1 sm:flex-none">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
            <select value={value} onChange={e => (set as (v: string) => void)(e.target.value)} className={selectCls}>
              <option value="">All</option>
              {(options as string[]).map(o => <option key={o} value={o}>{(fmt as (v: string) => string)(o)}</option>)}
            </select>
          </label>
        ))}
        <div className="flex gap-2 ml-auto">
          <button onClick={exportConversations} disabled={!filtered.length} className={btn} title="One row per conversation: setup, breaking points, costs, human and judge scores">Export conversations (CSV)</button>
          <button onClick={exportTurns} disabled={!filtered.length} className={btn} title="One row per turn: messages, replies, flags, notes, tokens and cost">Export turns (CSV)</button>
        </div>
      </div>

      {filtered.length === 0 ? <p className="text-sm text-muted-foreground">No conversations match these filters.</p> : <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Conversations" value={all.n} hint={`${num(all.avgTurns)} turns on average`} />
          <Tile label={`Broke down first in ${titleB}`} value={`${all.targetWorse} of ${all.n}`}
            hint={`English first: ${all.englishWorse} · same turn: ${all.outcomes['same-turn']}`} />
          <Tile label="Median first concern" value={<span>{num(all.medianFirstConcernEnglish, 1)} <span className="text-base text-muted-foreground">vs</span> {num(all.medianFirstConcernNative, 1)}</span>}
            hint={`Turn number, English vs ${titleB}`} />
          <Tile label="Total cost (via Otari)" value={usd(all.totalCost, 2)}
            hint={`Per conversation: ${usd(all.avgCostEnglish)} English, ${usd(all.avgCostNative)} ${titleB}`} />
        </div>

        <Card title="Where conversations break down"
          subtitle={<>Share of replies flagged <em>concerning</em> or <em>unsafe</em> at each turn, among conversations that reached that turn.</>}
          actions={<div className="flex items-center gap-4"><LegendKey color={SERIES.english} label="English" /><LegendKey color={SERIES.native} label={titleB} />
            <button onClick={() => setShowChartTable(s => !s)} className="text-xs text-primary hover:underline">{showChartTable ? 'Hide table' : 'Show as table'}</button></div>}>
          <ConcernByTurnChart data={byTurn} titleB={titleB} />
          {showChartTable && (
            <div className="mt-4">
              <Table head={<><Th>Turn</Th><Th right>Conversations</Th><Th right>English flagged</Th><Th right>{titleB} flagged</Th><Th right>Input tokens EN</Th><Th right>Input tokens {titleB}</Th><Th right>Token ratio</Th></>}>
                {byTurn.map(d => (
                  <tr key={d.turn}><Td strong>{d.turn}</Td><Td right>{d.n}</Td><Td right>{pct(d.english)}</Td><Td right>{pct(d.native)}</Td>
                    <Td right>{num(d.inputTokensEnglish, 0)}</Td><Td right>{num(d.inputTokensNative, 0)}</Td><Td right>{ratio(d.inputTokensEnglish, d.inputTokensNative)}</Td></tr>
                ))}
              </Table>
              <p className="text-xs text-muted-foreground mt-2">Input tokens grow each turn because the whole history is resent. The ratio shows whether the target language's extra token cost compounds over the conversation.</p>
            </div>
          )}
        </Card>

        <Card title="Which language broke down first?" subtitle="Compares the first turn flagged concerning or unsafe in each language, per conversation.">
          <OutcomeBars outcomes={all.outcomes} total={all.n} titleB={titleB} />
        </Card>

        <Card title="By target language">
          <Table head={<><Th>Language</Th><Th right>n</Th><Th right>Any concern EN</Th><Th right>Any concern target</Th><Th right>Unsafe EN</Th><Th right>Unsafe target</Th><Th right>Median first concern EN</Th><Th right>Median first concern target</Th><Th right>Target first</Th><Th right>English first</Th></>}>
            {byLanguage.map(g => (
              <tr key={g.key}><Td strong>{g.key}</Td><Td right>{g.n}</Td><Td right>{pct(g.concernRateEnglish)}</Td><Td right>{pct(g.concernRateNative)}</Td>
                <Td right>{pct(g.unsafeRateEnglish)}</Td><Td right>{pct(g.unsafeRateNative)}</Td>
                <Td right>{num(g.medianFirstConcernEnglish)}</Td><Td right>{num(g.medianFirstConcernNative)}</Td>
                <Td right>{g.targetWorse}</Td><Td right>{g.englishWorse}</Td></tr>
            ))}
          </Table>
        </Card>

        <Card title="By model under evaluation">
          <Table head={<><Th>Model</Th><Th>Weights</Th><Th right>n</Th><Th right>Any concern EN</Th><Th right>Any concern target</Th><Th right>Unsafe target</Th><Th right>Target first</Th><Th right>Cost / conv. EN</Th><Th right>Cost / conv. target</Th><Th right>Cost ratio</Th></>}>
            {byModel.map(g => {
              const lic = classifyModelLicense(g.key);
              return (
                <tr key={g.key}><Td strong>{getModelDisplayName(g.key)}</Td><Td>{lic === 'open-weight' ? 'Open' : lic === 'proprietary' ? 'Proprietary' : '—'}</Td><Td right>{g.n}</Td>
                  <Td right>{pct(g.concernRateEnglish)}</Td><Td right>{pct(g.concernRateNative)}</Td><Td right>{pct(g.unsafeRateNative)}</Td><Td right>{g.targetWorse}</Td>
                  <Td right>{usd(g.avgCostEnglish)}</Td><Td right>{usd(g.avgCostNative)}</Td><Td right>{ratio(g.avgCostEnglish, g.avgCostNative)}</Td></tr>
              );
            })}
          </Table>
        </Card>

        <Card title="Human vs LLM judge" subtitle="On your own criteria: how often the judge chose the same option as the evaluator (or both averages, for 1–5 scales). Only conversations the judge has scored.">
          {cca.length === 0 && hvj.length === 0 ? <p className="text-sm text-muted-foreground">No judge results on your criteria yet.</p> : (
            <Table head={<><Th>Criterion</Th><Th right>n</Th><Th right>Agreement EN</Th><Th right>Agreement target</Th></>}>
              {cca.map(c => (
                <tr key={c.label}><Td strong>{c.label}</Td><Td right>{c.n}</Td>
                  <Td right>{c.isSlider ? `${num(c.humanEnglish, 2)} vs ${num(c.judgeEnglish, 2)}` : pct(c.agreementEnglish)}</Td>
                  <Td right>{c.isSlider ? `${num(c.humanNative, 2)} vs ${num(c.judgeNative, 2)}` : pct(c.agreementNative)}</Td></tr>
              ))}
              {hvj.map(d => (
                <tr key={d.key}><Td strong>{d.label} <span className="text-xs text-muted-foreground font-normal">(earlier built-in)</span></Td><Td right>{d.n}</Td>
                  <Td right>{d.isSlider ? `${num(d.humanEnglish, 2)} vs ${num(d.judgeEnglish, 2)}` : `${pct(d.humanEnglish)} vs ${pct(d.judgeEnglish)}`}</Td>
                  <Td right>{d.isSlider ? `${num(d.humanNative, 2)} vs ${num(d.judgeNative, 2)}` : `${pct(d.humanNative)} vs ${pct(d.judgeNative)}`}</Td></tr>
              ))}
            </Table>
          )}
        </Card>
      </>}
    </div>
  );
};

export default MultiTurnDashboard;
