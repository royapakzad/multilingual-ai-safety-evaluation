// services/researchAnalytics.ts
//
// Pure functions behind the web-research run view, dashboard and CSV exports.

import { ResearchEvaluationRecord, ResearchTrace, SourceLabel, SourceType } from '../types';
import { RUBRIC_DIMENSIONS, isDimensionVisibleForRecord } from '../constants';

export type Side = 'english' | 'native';

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  government: 'Government', intergovernmental: 'UN / intergovernmental', ngo: 'NGO / civil society', news: 'News media',
  state_media: 'State-affiliated media', academic: 'Academic / research', reference: 'Reference (e.g. Wikipedia)',
  commercial: 'Commercial', forum_social: 'Forum / social media', other: 'Other',
};
export const SOURCE_TYPE_ORDER: SourceType[] = ['government', 'intergovernmental', 'ngo', 'academic', 'reference', 'news', 'state_media', 'commercial', 'forum_social', 'other'];

export const domainOf = (url: string): string => {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};
/** URL without query string, fragment or trailing slash, for matching citations to results. */
export const normUrl = (url: string): string => {
  try { const u = new URL(url); return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase(); } catch { return url.toLowerCase(); }
};

const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));

export const retrievedDomains = (t: ResearchTrace) => uniq(t.searches.flatMap(s => s.results.map(r => domainOf(r.url))).filter(Boolean));
export const citedDomains = (t: ResearchTrace) => uniq(t.citations.map(c => domainOf(c.url)).filter(Boolean));
export const openedDomains = (t: ResearchTrace) => uniq(t.opened.map(domainOf).filter(Boolean));
/** Every domain the run touched: retrieved, opened or cited. */
export const allDomains = (t: ResearchTrace) => uniq([...retrievedDomains(t), ...openedDomains(t), ...citedDomains(t)]);

/** Jaccard overlap of two domain sets (1 = identical, 0 = nothing in common). Null when both are empty. */
export const overlap = (a: string[], b: string[]) => {
  const A = new Set(a), B = new Set(b);
  const union = new Set([...A, ...B]).size;
  if (!union) return null;
  return [...A].filter(x => B.has(x)).length / union;
};

/** Best (lowest) rank at which each cited source appeared in the search results; null if it never did. */
export const citedRanks = (t: ResearchTrace): (number | null)[] => {
  const best = new Map<string, number>();
  t.searches.forEach(s => s.results.forEach(r => {
    const k = normUrl(r.url);
    if (!best.has(k) || best.get(k)! > r.rank) best.set(k, r.rank);
  }));
  return t.citations.map(c => best.get(normUrl(c.url)) ?? null);
};

export const labelFor = (labels: SourceLabel[], domain: string): SourceLabel | undefined => labels.find(l => l.domain === domain);

/** Whether a query language (as named by the analysis model) is the given language. */
export const languageMatches = (queryLanguage: string | null, languageName: string): boolean | null => {
  if (!queryLanguage) return null;
  const q = queryLanguage.toLowerCase();
  if (q.startsWith('mixed')) return false;
  const words = languageName.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4);
  return words.some(w => q.includes(w));
};

/** Per side: how many sources of each type were cited (by domain, counted once per run). */
export const citedTypeCounts = (r: ResearchEvaluationRecord, side: Side) => {
  const counts = SOURCE_TYPE_ORDER.reduce((a, t) => ({ ...a, [t]: 0 }), {} as Record<SourceType, number>);
  citedDomains(r[side]).forEach(d => { counts[labelFor(r.sourceLabels, d)?.type ?? 'other'] += 1; });
  return counts;
};

export const runMetrics = (r: ResearchEvaluationRecord) => {
  const side = (s: Side) => {
    const t = r[s];
    const ranks = citedRanks(t).filter((x): x is number => x != null);
    const langs = r.queryLanguages?.[s] ?? [];
    const target = s === 'english' ? 'English' : r.titleB;
    const matches = langs.map(l => languageMatches(l, target)).filter((x): x is boolean => x != null);
    const cited = citedDomains(t);
    const stateMedia = cited.filter(d => labelFor(r.sourceLabels, d)?.type === 'state_media').length;
    return {
      searches: t.searches.length,
      results: t.searches.reduce((a, x) => a + x.results.length, 0),
      opened: t.opened.length,
      citations: t.citations.length,
      citedDomains: cited.length,
      meanCitedRank: ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null,
      citedOutsideResults: citedRanks(t).filter(x => x == null).length,
      queriesInOwnLanguage: matches.length ? matches.filter(Boolean).length / matches.length : null,
      stateMediaCited: stateMedia,
      cost: t.usage?.costUsd ?? null,
    };
  };
  return {
    english: side('english'), native: side('native'),
    retrievedOverlap: overlap(retrievedDomains(r.english), retrievedDomains(r.native)),
    citedOverlap: overlap(citedDomains(r.english), citedDomains(r.native)),
  };
};

export const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

// --- CSV --------------------------------------------------------------------------------------

const scoreCols = (prefix: string, scores: any, r: ResearchEvaluationRecord) => {
  const out: Record<string, unknown> = {};
  if (!scores) return out;
  RUBRIC_DIMENSIONS.forEach(d => { if (isDimensionVisibleForRecord(r.hiddenBuiltInKeys, d.key)) out[`${prefix}_${d.key}`] = scores[d.key]; });
  (scores.custom_criteria ?? []).forEach((c: any) => { out[`${prefix}_custom_${c.label}`] = c.value; });
  return out;
};

/** One row per run. */
export const researchRunRows = (records: ResearchEvaluationRecord[]) => records.map(r => {
  const m = runMetrics(r);
  const side = (p: string, s: Side) => ({
    [`${p}_engine`]: r[s].engine, [`${p}_searches`]: m[s].searches, [`${p}_queries`]: r[s].searches.map(x => x.query).join(' | '),
    [`${p}_query_languages`]: (r.queryLanguages?.[s] ?? []).join(' | '), [`${p}_queries_in_own_language`]: m[s].queriesInOwnLanguage,
    [`${p}_results`]: m[s].results, [`${p}_pages_opened`]: m[s].opened, [`${p}_citations`]: m[s].citations,
    [`${p}_cited_domains`]: citedDomains(r[s]).join(' | '), [`${p}_mean_rank_of_cited`]: m[s].meanCitedRank,
    [`${p}_cited_outside_results`]: m[s].citedOutsideResults, [`${p}_state_media_cited`]: m[s].stateMediaCited,
    [`${p}_cost_usd`]: m[s].cost, [`${p}_seconds`]: r[s].durationSeconds, [`${p}_answer`]: r[s].answer,
    [`${p}_cited_source_languages`]: sourceLanguageCounts([r]).filter(x => (s === 'english' ? x.englishCited : x.nativeCited) > 0)
      .map(x => `${x.language}: ${s === 'english' ? x.englishCited : x.nativeCited}`).join(' | '),
  });
  return {
    run_id: r.id, timestamp: r.timestamp, evaluator: r.userEmail, evaluation_name: r.evaluationName, scenario: r.scenarioContext,
    language_pair: r.languagePair, model: r.model, search_mode: r.searchMode, question_english: r.english.question, question_target: r.native.question,
    translation: r.translationModel ?? '',
    retrieved_domain_overlap: m.retrievedOverlap, cited_domain_overlap: m.citedOverlap,
    ...side('english', 'english'), ...side('target', 'native'),
    analysis_model: r.analysisModel ?? '', human_notes: r.notes,
    ...scoreCols('human_english', r.humanScores?.english, r), ...scoreCols('human_target', r.humanScores?.native, r),
  };
});

/** One row per source per side: where it ranked, whether it was opened and cited, and its label. */
export const researchSourceRows = (records: ResearchEvaluationRecord[]) => records.flatMap(r => (['english', 'native'] as Side[]).flatMap(s => {
  const t = r[s];
  const cited = new Set(t.citations.map(c => normUrl(c.url)));
  const openedSet = new Set(t.opened.map(normUrl));
  const rows = new Map<string, Record<string, unknown>>();
  const add = (url: string, extra: Record<string, unknown>) => {
    const k = normUrl(url);
    const d = domainOf(url);
    const l = labelFor(r.sourceLabels, d);
    const prev = rows.get(k);
    rows.set(k, {
      run_id: r.id, evaluation_name: r.evaluationName, language_pair: r.languagePair, model: r.model, search_mode: r.searchMode,
      side: s === 'english' ? 'English' : r.titleB, engine: t.engine, url, domain: d,
      source_type: l?.type ?? '', source_country: l?.country ?? '', source_language: l?.language ?? '', label_confirmed: l?.confirmed ?? false,
      opened: openedSet.has(k), cited: cited.has(k), ...prev, ...extra,
    });
  };
  t.searches.forEach(x => x.results.forEach(res => {
    const k = normUrl(res.url);
    if (!rows.has(k)) add(res.url, { search: x.index, query: x.query, rank: res.rank, title: res.title, date: res.date ?? '' });
  }));
  t.opened.forEach(u => { if (!rows.has(normUrl(u))) add(u, { search: '', query: '', rank: '', title: '', date: '' }); });
  t.citations.forEach(c => { if (!rows.has(normUrl(c.url))) add(c.url, { search: '', query: '', rank: '', title: c.title, date: '' }); });
  return Array.from(rows.values());
}));

/**
 * How many websites of each language each side saw and cited (each website counted once per
 * side). Language comes from the source labels; unlabeled sites count as "Unknown".
 */
export const sourceLanguageCounts = (records: Pick<ResearchEvaluationRecord, 'english' | 'native' | 'sourceLabels'>[]) => {
  const rows = new Map<string, { language: string; englishSeen: number; englishCited: number; nativeSeen: number; nativeCited: number }>();
  const bump = (lang: string, key: 'englishSeen' | 'englishCited' | 'nativeSeen' | 'nativeCited') => {
    const r = rows.get(lang) ?? { language: lang, englishSeen: 0, englishCited: 0, nativeSeen: 0, nativeCited: 0 };
    r[key] += 1; rows.set(lang, r);
  };
  records.forEach(rec => (['english', 'native'] as Side[]).forEach(s => {
    const lang = (d: string) => labelFor(rec.sourceLabels, d)?.language?.trim() || 'Unknown';
    allDomains(rec[s]).forEach(d => bump(lang(d), s === 'english' ? 'englishSeen' : 'nativeSeen'));
    citedDomains(rec[s]).forEach(d => bump(lang(d), s === 'english' ? 'englishCited' : 'nativeCited'));
  }));
  return Array.from(rows.values()).sort((a, b) =>
    (a.language === 'Unknown' ? 1 : 0) - (b.language === 'Unknown' ? 1 : 0) || (b.englishSeen + b.nativeSeen) - (a.englishSeen + a.nativeSeen));
};
