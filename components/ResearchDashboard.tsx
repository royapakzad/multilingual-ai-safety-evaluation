import React, { useMemo, useState } from 'react';
import { ResearchEvaluationRecord, SourceType } from '../types';
import { getModelDisplayName, classifyModelLicense } from '../constants';
import {
  runMetrics, mean, citedDomains, labelFor, SOURCE_TYPE_LABELS, SOURCE_TYPE_ORDER, researchRunRows, researchSourceRows, sourceLanguageCounts, Side,
} from '../services/researchAnalytics';
import { toCsv, downloadCsv } from '../services/multiTurnAnalytics';

/**
 * Dashboard for web-research runs: whether the agent searched in the question's language, how
 * much the two languages' sources overlap, what kinds of sources each language was given
 * (incl. state-affiliated media), per model and per search engine, and cost.
 * English = blue, target language = orange everywhere (validated categorical pair), always
 * with a legend and values so colour is never the only cue.
 */

const SERIES = { english: '#2a78d6', native: '#eb6834' };
const ENGINE_LABEL: Record<string, string> = { anthropic: "Claude's own", openai: "OpenAI's own", otari: "Otari's (Tavily)" };

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const n1 = (v: number | null) => (v == null ? '—' : v.toFixed(1));
const usd = (v: number | null, d = 4) => (v == null ? '—' : `$${v.toFixed(d)}`);

const Card: React.FC<{ title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, actions, children }) => (
  <section className="bg-card border border-border rounded-xl p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div><h3 className="text-base font-semibold text-foreground">{title}</h3>{subtitle && <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{subtitle}</p>}</div>
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
const Key: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />{label}</span>
);
const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => <th scope="col" className={`px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
const Td: React.FC<{ children?: React.ReactNode; right?: boolean; strong?: boolean }> = ({ children, right, strong }) => <td className={`px-3 py-2 text-sm whitespace-nowrap ${right ? 'text-right tabular-nums' : ''} ${strong ? 'font-medium text-foreground' : 'text-card-foreground'}`}>{children}</td>;
const Table: React.FC<{ head: React.ReactNode; children: React.ReactNode }> = ({ head, children }) => (
  <div className="overflow-x-auto -mx-1"><table className="min-w-full"><thead className="border-b border-border"><tr>{head}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></div>
);

/** Share of cited websites of each type, English vs target, as paired horizontal bars. */
type PairRow = { key: string; label: string; warn?: boolean; english: number; native: number; nEnglish: number; nNative: number };
const PairedBars: React.FC<{ rows: PairRow[]; titleB: string; unit: string }> = ({ rows: shares, titleB, unit }) => {
  const max = Math.max(0.0001, ...shares.flatMap(s => [s.english, s.native]));
  return (
    <ul className="space-y-3">
      {shares.map(s => (
        <li key={s.key} className="grid grid-cols-[minmax(0,12rem)_1fr] gap-3 items-center">
          <span className={`text-sm ${s.warn ? 'text-amber-800 font-medium' : 'text-foreground'}`}>{s.warn && '⚠ '}{s.label}</span>
          <span className="space-y-[2px]">
            {(['english', 'native'] as const).map(side => (
              <span key={side} className="flex items-center gap-2" title={`${side === 'english' ? 'English' : titleB}: ${pct(s[side])} of ${unit} (${side === 'english' ? s.nEnglish : s.nNative})`}>
                <span className="flex-1 h-2.5 bg-muted rounded-[3px] overflow-hidden">
                  <span className="block h-full rounded-[3px]" style={{ width: `${(s[side] / max) * 100}%`, background: SERIES[side] }} />
                </span>
                <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{pct(s[side])} <span className="opacity-70">({side === 'english' ? s.nEnglish : s.nNative})</span></span>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
};

const ResearchDashboard: React.FC<{ records: ResearchEvaluationRecord[]; evaluationName: string }> = ({ records, evaluationName }) => {
  const [language, setLanguage] = useState('');
  const [model, setModel] = useState('');
  const [mode, setMode] = useState('');
  const [showMixTable, setShowMixTable] = useState(false);

  const languages = useMemo(() => Array.from(new Set(records.map(r => r.titleB))).sort(), [records]);
  const models = useMemo(() => Array.from(new Set(records.map(r => r.model))).sort(), [records]);
  const filtered = useMemo(() => records.filter(r => (!language || r.titleB === language) && (!model || r.model === model) && (!mode || r.searchMode === mode)), [records, language, model, mode]);
  const titleB = language || (languages.length === 1 ? languages[0] : 'Target language');

  const data = useMemo(() => {
    const metrics = filtered.map(r => ({ r, m: runMetrics(r) }));
    const side = (s: Side) => ({
      searches: mean(metrics.map(x => x.m[s].searches)),
      ownLanguage: mean(metrics.map(x => x.m[s].queriesInOwnLanguage)),
      citedRank: mean(metrics.map(x => x.m[s].meanCitedRank)),
      stateMedia: metrics.reduce((a, x) => a + x.m[s].stateMediaCited, 0),
      cost: mean(metrics.map(x => x.m[s].cost)),
    });
    // Source-type mix: count each cited website once per run and side
    const typeCounts = (s: Side) => {
      const c = SOURCE_TYPE_ORDER.reduce((a, t) => ({ ...a, [t]: 0 }), {} as Record<SourceType, number>);
      filtered.forEach(r => citedDomains(r[s]).forEach(d => { c[labelFor(r.sourceLabels, d)?.type ?? 'other'] += 1; }));
      return c;
    };
    const ce = typeCounts('english'), cn = typeCounts('native');
    const te = Object.values(ce).reduce((a, b) => a + b, 0), tn = Object.values(cn).reduce((a, b) => a + b, 0);
    const shares: PairRow[] = SOURCE_TYPE_ORDER.map(t => ({ key: t, label: SOURCE_TYPE_LABELS[t], warn: t === 'state_media', english: te ? ce[t] / te : 0, native: tn ? cn[t] / tn : 0, nEnglish: ce[t], nNative: cn[t] }))
      .filter(s => s.nEnglish || s.nNative);
    // Languages of cited websites, per side
    const langCounts = sourceLanguageCounts(filtered);
    const le = langCounts.reduce((a, r) => a + r.englishCited, 0), ln = langCounts.reduce((a, r) => a + r.nativeCited, 0);
    const langShares: PairRow[] = langCounts.filter(r => r.englishCited || r.nativeCited)
      .map(r => ({ key: r.language, label: r.language, english: le ? r.englishCited / le : 0, native: ln ? r.nativeCited / ln : 0, nEnglish: r.englishCited, nNative: r.nativeCited }));

    const byModel = Array.from(new Set(filtered.map(r => r.model))).map(mid => {
      const rows = metrics.filter(x => x.r.model === mid);
      const avg = (f: (x: typeof rows[number]) => number | null) => mean(rows.map(f));
      return {
        model: mid, n: rows.length, engines: Array.from(new Set(rows.flatMap(x => [x.r.english.engine, x.r.native.engine]))).map(e => ENGINE_LABEL[e]).join(', '),
        searchesEn: avg(x => x.m.english.searches), searchesNa: avg(x => x.m.native.searches),
        ownEn: avg(x => x.m.english.queriesInOwnLanguage), ownNa: avg(x => x.m.native.queriesInOwnLanguage),
        rankEn: avg(x => x.m.english.meanCitedRank), rankNa: avg(x => x.m.native.meanCitedRank),
        citedOverlap: avg(x => x.m.citedOverlap), stateNa: rows.reduce((a, x) => a + x.m.native.stateMediaCited, 0),
        costEn: avg(x => x.m.english.cost), costNa: avg(x => x.m.native.cost),
      };
    }).sort((a, b) => b.n - a.n);

    const topSites = (s: Side) => {
      const c = new Map<string, number>();
      filtered.forEach(r => citedDomains(r[s]).forEach(d => c.set(d, (c.get(d) ?? 0) + 1)));
      return Array.from(c.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([domain, count]) => ({ domain, count, label: filtered.map(r => labelFor(r.sourceLabels, domain)).find(Boolean) }));
    };

    const totalCost = filtered.reduce((a, r) => a + [r.english.usage, r.native.usage, r.translationUsage, r.analysisUsage].reduce((b, u) => b + (u?.costUsd ?? 0), 0), 0);
    return {
      english: side('english'), native: side('native'),
      retrievedOverlap: mean(metrics.map(x => x.m.retrievedOverlap)), citedOverlap: mean(metrics.map(x => x.m.citedOverlap)),
      shares, langShares, langCounts, byModel, topEnglish: topSites('english'), topNative: topSites('native'), totalCost,
    };
  }, [filtered]);
  const [showLangTable, setShowLangTable] = useState(false);

  const slug = evaluationName.replace(/[^\w-]+/g, '_').slice(0, 40) || 'evaluation';
  const stamp = new Date().toISOString().slice(0, 10);
  const selectCls = 'w-full p-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring';
  const btn = 'px-3.5 py-2 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 transition-colors';

  if (!records.length) return <p className="text-sm text-muted-foreground">The dashboard fills in once you have saved a research run.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[11rem] flex-1 sm:flex-none"><span className="block text-xs font-medium text-muted-foreground mb-1">Language</span>
          <select value={language} onChange={e => setLanguage(e.target.value)} className={selectCls}><option value="">All</option>{languages.map(l => <option key={l} value={l}>{l}</option>)}</select></label>
        <label className="min-w-[11rem] flex-1 sm:flex-none"><span className="block text-xs font-medium text-muted-foreground mb-1">Model</span>
          <select value={model} onChange={e => setModel(e.target.value)} className={selectCls}><option value="">All</option>{models.map(m => <option key={m} value={m}>{getModelDisplayName(m)}</option>)}</select></label>
        <label className="min-w-[11rem] flex-1 sm:flex-none"><span className="block text-xs font-medium text-muted-foreground mb-1">Search engine</span>
          <select value={mode} onChange={e => setMode(e.target.value)} className={selectCls}><option value="">All</option><option value="native">Model’s own search</option><option value="otari">Same search for all</option></select></label>
        <div className="flex gap-2 ml-auto">
          <button disabled={!filtered.length} onClick={() => downloadCsv(`${slug}_research_runs_${stamp}.csv`, toCsv(researchRunRows(filtered)))} className={btn} title="One row per run: queries, query languages, overlap, cited sites, costs, your scores">Export runs (CSV)</button>
          <button disabled={!filtered.length} onClick={() => downloadCsv(`${slug}_research_sources_${stamp}.csv`, toCsv(researchSourceRows(filtered)))} className={btn} title="One row per source per language: rank, opened, cited, type, country">Export sources (CSV)</button>
        </div>
      </div>

      {!filtered.length ? <p className="text-sm text-muted-foreground">No runs match these filters.</p> : <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Research runs" value={filtered.length} hint={`${n1(data.english.searches)} vs ${n1(data.native.searches)} searches per run (English vs ${titleB})`} />
          <Tile label={`Searched in ${titleB}`} value={pct(data.native.ownLanguage)} hint={`share of ${titleB} questions' searches written in ${titleB}`} />
          <Tile label="Same websites cited" value={pct(data.citedOverlap)} hint={`overlap between languages · retrieved: ${pct(data.retrievedOverlap)}`} />
          <Tile label="State-affiliated media cited" value={`${data.english.stateMedia} vs ${data.native.stateMedia}`} hint={`websites, English vs ${titleB} · total cost ${usd(data.totalCost, 2)}`} />
        </div>

        <Card title="What kinds of sources were cited" subtitle="Share of cited websites of each type, per language. Each website counts once per run. Types come from the source labels (suggested, then checked by evaluators)."
          actions={<div className="flex items-center gap-4"><Key color={SERIES.english} label="English" /><Key color={SERIES.native} label={titleB} />
            <button onClick={() => setShowMixTable(s => !s)} className="text-xs text-primary hover:underline">{showMixTable ? 'Hide table' : 'Show as table'}</button></div>}>
          {data.shares.length ? <PairedBars rows={data.shares} titleB={titleB} unit="cited websites" /> : <p className="text-sm text-muted-foreground">No cited sources yet.</p>}
          {showMixTable && (
            <div className="mt-4"><Table head={<><Th>Type</Th><Th right>English (websites)</Th><Th right>English share</Th><Th right>{titleB} (websites)</Th><Th right>{titleB} share</Th></>}>
              {data.shares.map(s => <tr key={s.key}><Td strong>{s.label}</Td><Td right>{s.nEnglish}</Td><Td right>{pct(s.english)}</Td><Td right>{s.nNative}</Td><Td right>{pct(s.native)}</Td></tr>)}
            </Table></div>
          )}
        </Card>

        <Card title="Languages of the sources" subtitle="Share and number of cited websites in each language, for English questions and for questions in the target language. The table also counts every website each run saw."
          actions={<div className="flex items-center gap-4"><Key color={SERIES.english} label="English question" /><Key color={SERIES.native} label={`${titleB} question`} />
            <button onClick={() => setShowLangTable(s => !s)} className="text-xs text-primary hover:underline">{showLangTable ? 'Hide table' : 'Show as table'}</button></div>}>
          {data.langShares.length ? <PairedBars rows={data.langShares} titleB={titleB} unit="cited websites" /> : <p className="text-sm text-muted-foreground">No cited sources yet.</p>}
          {showLangTable && (
            <div className="mt-4"><Table head={<><Th>Website language</Th><Th right>English run: seen</Th><Th right>cited</Th><Th right>{titleB} run: seen</Th><Th right>cited</Th></>}>
              {data.langCounts.map(r => <tr key={r.language}><Td strong>{r.language}</Td><Td right>{r.englishSeen}</Td><Td right>{r.englishCited}</Td><Td right>{r.nativeSeen}</Td><Td right>{r.nativeCited}</Td></tr>)}
            </Table></div>
          )}
        </Card>

        <Card title="By model" subtitle="How each model researched in each language. Rank 1 = the top search result.">
          <Table head={<><Th>Model</Th><Th>Weights</Th><Th>Search engine</Th><Th right>n</Th><Th right>Searches EN / target</Th><Th right>In own language EN / target</Th><Th right>Avg. rank cited EN / target</Th><Th right>Same sites cited</Th><Th right>State media (target)</Th><Th right>Cost / run EN / target</Th></>}>
            {data.byModel.map(m => {
              const lic = classifyModelLicense(m.model);
              return (
                <tr key={m.model}><Td strong>{getModelDisplayName(m.model)}</Td><Td>{lic === 'open-weight' ? 'Open' : lic === 'proprietary' ? 'Proprietary' : '—'}</Td><Td>{m.engines}</Td><Td right>{m.n}</Td>
                  <Td right>{n1(m.searchesEn)} / {n1(m.searchesNa)}</Td><Td right>{pct(m.ownEn)} / {pct(m.ownNa)}</Td><Td right>{n1(m.rankEn)} / {n1(m.rankNa)}</Td>
                  <Td right>{pct(m.citedOverlap)}</Td><Td right>{m.stateNa}</Td><Td right>{usd(m.costEn)} / {usd(m.costNa)}</Td></tr>
              );
            })}
          </Table>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(['english', 'native'] as const).map(s => (
            <Card key={s} title={`Most-cited websites: ${s === 'english' ? 'English' : titleB}`}>
              {(s === 'english' ? data.topEnglish : data.topNative).length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
                <Table head={<><Th>Website</Th><Th>Type</Th><Th right>Runs</Th></>}>
                  {(s === 'english' ? data.topEnglish : data.topNative).map(x => (
                    <tr key={x.domain}><Td strong>{x.domain}</Td><Td>{x.label ? `${SOURCE_TYPE_LABELS[x.label.type]}${x.label.country ? ` · ${x.label.country}` : ''}` : '—'}</Td><Td right>{x.count}</Td></tr>
                  ))}
                </Table>
              )}
            </Card>
          ))}
        </div>

      </>}
    </div>
  );
};

export default ResearchDashboard;
