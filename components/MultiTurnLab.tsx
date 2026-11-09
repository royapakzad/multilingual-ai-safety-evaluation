import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  User, MultiTurnEvaluationRecord, ConversationTurn, ConversationSide, TurnFlag,
  LanguageSpecificRubricScores, HarmDisparityMetrics, CustomCriterionScore, LlmCallUsage, GatewayWorkspace
} from '../types';
import {
  INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES, INITIAL_HARM_DISPARITY_METRICS, AVAILABLE_NATIVE_LANGUAGES,
  DEFAULT_EVALUATED_MODEL, DEFAULT_TRANSLATION_MODEL, DEFAULT_JUDGE_MODEL, getModelDisplayName
} from '../constants';
import {
  generateChatResponse, translateText, evaluateConversationWithLlm, fetchGatewayWorkspace, ChatMessage
} from '../services/llmService';
import * as db from '../services/databaseService';
import ModelSelector from './ModelSelector';
import EvaluationForm from './EvaluationForm';
import LoadingSpinner from './LoadingSpinner';
import { ModeBadge } from './EvaluationModes';
import MultiTurnDashboard from './MultiTurnDashboard';
import { MANUAL_TRANSLATION, usePersistedModel, useEvaluationCriteria } from './labShared';

/**
 * Multi-turn conversation evaluation. The same conversation is held in English and in the
 * target language with the same model; the evaluator flags each reply, then scores both
 * whole conversations with the rubric. Records are stored as labType 'multiturn' and never
 * shown in the single-prompt lab.
 */

const MAX_TURNS = 15;

const md = (text: string) => ({ __html: DOMPurify.sanitize(marked(text || '', { breaks: true, gfm: true }) as string) });

const emptySide = (user: string): ConversationSide => ({ user, assistant: '', flag: null, note: '', usage: null, durationSeconds: null });

/** System prompt + all earlier turns + the new user message, for one side. */
const historyFor = (turns: ConversationTurn[], side: 'english' | 'native', systemPrompt: string, newUser: string): ChatMessage[] => [
  ...(systemPrompt.trim() ? [{ role: 'system' as const, content: systemPrompt.trim() }] : []),
  ...turns.flatMap(t => [
    { role: 'user' as const, content: t[side].user },
    { role: 'assistant' as const, content: t[side].assistant },
  ]),
  { role: 'user' as const, content: newUser },
];

const firstTurnWhere = (turns: ConversationTurn[], side: 'english' | 'native', flags: TurnFlag[]) =>
  turns.find(t => t[side].flag && flags.includes(t[side].flag!))?.index ?? null;

const fmtCost = (u: LlmCallUsage | null) => (u?.costUsd != null ? `$${u.costUsd.toFixed(5)}` : null);

// --- Small presentational pieces -------------------------------------------------------------

const FLAG_STYLES: Record<TurnFlag, { label: string; on: string }> = {
  ok:         { label: 'OK',         on: 'bg-emerald-50 border-emerald-500 text-emerald-800' },
  concerning: { label: 'Concerning', on: 'bg-amber-50 border-amber-500 text-amber-800' },
  unsafe:     { label: 'Unsafe',     on: 'bg-red-50 border-red-500 text-red-800' },
};

const FlagPicker: React.FC<{ value: TurnFlag | null; onChange: (f: TurnFlag | null) => void; disabled?: boolean; label: string }> =
  ({ value, onChange, disabled, label }) => (
  <div role="radiogroup" aria-label={label} className="inline-flex gap-1">
    {(Object.keys(FLAG_STYLES) as TurnFlag[]).map(f => {
      const active = value === f;
      return (
        <button
          key={f} type="button" role="radio" aria-checked={active} disabled={disabled}
          onClick={() => onChange(active ? null : f)}
          className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default ${
            active ? FLAG_STYLES[f].on : 'border-border text-muted-foreground hover:text-foreground hover:border-gray-400 bg-card'
          }`}
        >
          {FLAG_STYLES[f].label}
        </button>
      );
    })}
  </div>
);

const SideCell: React.FC<{
  side: ConversationSide; lang: string; dir?: 'rtl' | 'ltr'; pending?: boolean; readOnly?: boolean;
  onFlag?: (f: TurnFlag | null) => void; onNote?: (n: string) => void;
}> = ({ side, lang, pending, readOnly, onFlag, onNote }) => {
  const [showNote, setShowNote] = useState(!!side.note);
  return (
    <div className="min-w-0 flex flex-col gap-3">
      <div className="self-end max-w-[90%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-sm text-foreground whitespace-pre-wrap" lang={lang} dir="auto">
        {side.user}
      </div>
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        {pending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><LoadingSpinner size="sm" /> Waiting for the model…</div>
        ) : (
          <>
            <div className="prose prose-sm max-w-none text-card-foreground prose-p:my-1.5" lang={lang} dir="auto" dangerouslySetInnerHTML={md(side.assistant)} />
            <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <FlagPicker value={side.flag} onChange={f => onFlag?.(f)} disabled={readOnly} label="Flag this reply" />
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {[side.durationSeconds != null ? `${side.durationSeconds.toFixed(1)}s` : null,
                  side.usage?.totalTokens != null ? `${side.usage.totalTokens} tokens` : null,
                  fmtCost(side.usage), side.usage?.fallback ? 'fallback' : null].filter(Boolean).join(' · ')}
              </span>
            </div>
            {!readOnly && !showNote && (
              <button type="button" onClick={() => setShowNote(true)} className="mt-2 text-xs text-primary hover:underline">Add a note</button>
            )}
            {(showNote || (readOnly && side.note)) && (
              readOnly ? <p className="mt-2 text-xs text-muted-foreground italic">{side.note}</p> : (
                <textarea
                  value={side.note} onChange={e => onNote?.(e.target.value)} rows={2} placeholder="What made this reply concerning?"
                  className="mt-2 w-full text-sm p-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};

const TurnRow: React.FC<{
  turn: ConversationTurn; titleA: string; titleB: string; langB: string; pending?: boolean; readOnly?: boolean;
  onChange?: (side: 'english' | 'native', patch: Partial<ConversationSide>) => void;
}> = ({ turn, titleA, titleB, langB, pending, readOnly, onChange }) => (
  <li className="border-t border-border pt-5">
    <div className="flex items-baseline justify-between gap-3 mb-3">
      <h3 className="text-sm font-semibold text-foreground">Turn {turn.index}</h3>
      <span className="text-[11px] text-muted-foreground">
        {turn.translationModel === MANUAL_TRANSLATION ? 'Target-language message written by the evaluator'
          : turn.translationModel ? `Translated by ${getModelDisplayName(turn.translationModel)}${fmtCost(turn.translationUsage) ? ` · ${fmtCost(turn.translationUsage)}` : ''}` : ''}
      </span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <div>
        <p className="md:hidden text-xs font-semibold text-muted-foreground mb-2">{titleA}</p>
        <SideCell side={turn.english} lang="en" pending={pending && !turn.english.assistant} readOnly={readOnly}
          onFlag={f => onChange?.('english', { flag: f })} onNote={n => onChange?.('english', { note: n })} />
      </div>
      <div>
        <p className="md:hidden text-xs font-semibold text-muted-foreground mb-2">{titleB}</p>
        <SideCell side={turn.native} lang={langB} pending={pending && !turn.native.assistant} readOnly={readOnly}
          onFlag={f => onChange?.('native', { flag: f })} onNote={n => onChange?.('native', { note: n })} />
      </div>
    </div>
  </li>
);

const BreakingPoint: React.FC<{ titleA: string; titleB: string; turns: ConversationTurn[] }> = ({ titleA, titleB, turns }) => {
  const cell = (side: 'english' | 'native') => {
    const unsafe = firstTurnWhere(turns, side, ['unsafe']);
    const concern = firstTurnWhere(turns, side, ['concerning', 'unsafe']);
    if (concern == null) return <span className="text-muted-foreground">No concerns flagged</span>;
    return (
      <span>
        First concern at <strong className="text-foreground">turn {concern}</strong>
        {unsafe != null && <> · first unsafe at <strong className="text-red-700">turn {unsafe}</strong></>}
      </span>
    );
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
      <div className="rounded-lg border border-border bg-card px-3 py-2"><span className="text-xs text-muted-foreground block">{titleA}</span>{cell('english')}</div>
      <div className="rounded-lg border border-border bg-card px-3 py-2"><span className="text-xs text-muted-foreground block">{titleB}</span>{cell('native')}</div>
    </div>
  );
};

// --- Main component --------------------------------------------------------------------------

interface MultiTurnLabProps {
  currentUser: User;
  evaluationName: string;
  onLeaveEvaluation: () => void;
}

const MultiTurnLab: React.FC<MultiTurnLabProps> = ({ currentUser, evaluationName, onLeaveEvaluation }) => {
  // Models (same remembered choices as the single-prompt lab)
  const [selectedModel, setSelectedModel] = usePersistedModel('mlal.model.evaluated', DEFAULT_EVALUATED_MODEL);
  const [translationModel, setTranslationModel] = usePersistedModel('mlal.model.translation', DEFAULT_TRANSLATION_MODEL);
  const [judgeModel, setJudgeModel] = usePersistedModel('mlal.model.judge', DEFAULT_JUDGE_MODEL);
  const [workspace, setWorkspace] = useState<GatewayWorkspace | null>(null);

  // Rubric configuration, scoped to multi-turn so it never affects a single-prompt evaluation of the same name
  // Conversations are scored only on the evaluator's own criteria (no built-in rubric).
  const criteria = useEvaluationCriteria(`multi-turn:${evaluationName}`, { builtIns: false });

  // Setup
  const [languageCode, setLanguageCode] = useState('');
  const [scenarioContext, setScenarioContext] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [style, setStyle] = useState<'live' | 'scripted'>('live');
  const [script, setScript] = useState<string[]>(['', '']);

  // Conversation
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const turnsRef = useRef<ConversationTurn[]>([]);
  useEffect(() => { turnsRef.current = turns; }, [turns]);
  const [pendingTurn, setPendingTurn] = useState<ConversationTurn | null>(null);
  const [draftEn, setDraftEn] = useState('');
  const [draftNative, setDraftNative] = useState('');
  const [machineDraft, setMachineDraft] = useState<{ text: string; usage: LlmCallUsage } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scoring
  const [phase, setPhase] = useState<'conversation' | 'scoring'>('conversation');
  // A saved conversation being edited (its flags, notes and scores; the messages stay as they were)
  const [editing, setEditing] = useState<MultiTurnEvaluationRecord | null>(null);
  const [view, setView] = useState<'conversations' | 'dashboard'>('conversations');
  const [scoresA, setScoresA] = useState<LanguageSpecificRubricScores>({ ...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES });
  const [scoresB, setScoresB] = useState<LanguageSpecificRubricScores>({ ...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES });
  const [disparity, setDisparity] = useState<HarmDisparityMetrics>({ ...INITIAL_HARM_DISPARITY_METRICS });
  const [notes, setNotes] = useState('');
  const [flaggedForReview, setFlaggedForReview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Saved conversations in this evaluation
  const [records, setRecords] = useState<MultiTurnEvaluationRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);

  const language = AVAILABLE_NATIVE_LANGUAGES.find(l => l.code === languageCode);
  const titleA = 'English';
  const titleB = editing?.titleB ?? language?.name ?? 'Target language';
  const langCode = editing?.languageCode ?? languageCode;
  const isManual = translationModel === MANUAL_TRANSLATION;
  const started = turns.length > 0 || !!pendingTurn;
  const atLimit = turns.length >= MAX_TURNS;

  const loadRecords = async () => {
    const all = await db.getEvaluations(currentUser);
    setRecords(all.filter((r): r is MultiTurnEvaluationRecord => r.labType === 'multiturn' && r.evaluationName === evaluationName));
    setIsLoadingRecords(false);
  };
  useEffect(() => { loadRecords().catch(e => { setError(String(e?.message ?? e)); setIsLoadingRecords(false); }); }, [currentUser, evaluationName]);
  useEffect(() => { fetchGatewayWorkspace().then(setWorkspace).catch(() => {}); }, [currentUser]);

  // Warn before leaving the page with an unsaved conversation
  useEffect(() => {
    if (!started) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [started]);

  // Live mode: auto-translate the English draft (debounced), like the single-prompt lab
  useEffect(() => {
    if (style !== 'live' || isManual || !languageCode || !draftEn.trim()) {
      if (!draftEn.trim() && !isManual) { setDraftNative(''); setMachineDraft(null); }
      return;
    }
    const timer = setTimeout(async () => {
      setIsTranslating(true);
      try {
        const t = await translateText(draftEn, 'en', languageCode, translationModel);
        setDraftNative(t.text);
        setMachineDraft({ text: t.text, usage: t.usage });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsTranslating(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [draftEn, languageCode, translationModel, style, isManual]);

  /** Sends one user turn to both sides (in parallel) and appends the result. */
  const runTurn = async (en: string, native: string, translation: { model: string; usage: LlmCallUsage | null }) => {
    const history = turnsRef.current;
    const turn: ConversationTurn = {
      index: history.length + 1,
      english: emptySide(en), native: emptySide(native),
      translationModel: translation.model, translationUsage: translation.usage,
    };
    setPendingTurn(turn);
    const timed = async (messages: ChatMessage[]) => {
      const t0 = performance.now();
      const r = await generateChatResponse(messages, selectedModel);
      return { ...r, seconds: (performance.now() - t0) / 1000 };
    };
    try {
      const [a, b] = await Promise.all([
        timed(historyFor(history, 'english', systemPrompt, en)),
        timed(historyFor(history, 'native', systemPrompt, native)),
      ]);
      const done: ConversationTurn = {
        ...turn,
        english: { ...turn.english, assistant: a.text, usage: a.usage, durationSeconds: a.seconds },
        native: { ...turn.native, assistant: b.text, usage: b.usage, durationSeconds: b.seconds },
      };
      turnsRef.current = [...history, done];
      setTurns(turnsRef.current);
    } finally {
      setPendingTurn(null);
    }
  };

  const sendLiveTurn = async () => {
    const en = draftEn.trim(), native = draftNative.trim();
    if (!en || !native || !languageCode) return;
    setIsSending(true); setError(null);
    const machineUnchanged = !isManual && machineDraft && machineDraft.text.trim() === native;
    try {
      await runTurn(en, native, machineUnchanged ? { model: translationModel, usage: machineDraft!.usage } : { model: MANUAL_TRANSLATION, usage: null });
      setDraftEn(''); setDraftNative(''); setMachineDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSending(false);
    }
  };

  const remainingScript = script.slice(turns.length).filter(s => s.trim());
  const runScript = async (all: boolean) => {
    if (!languageCode || isManual) return;
    setIsSending(true); setError(null);
    try {
      let i = turnsRef.current.length;
      do {
        const en = (script[i] ?? '').trim();
        if (!en || i >= MAX_TURNS) break;
        const t = await translateText(en, 'en', languageCode, translationModel);
        await runTurn(en, t.text, { model: translationModel, usage: t.usage });
        i = turnsRef.current.length;
      } while (all);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSending(false);
    }
  };

  const updateTurn = (index: number, side: 'english' | 'native', patch: Partial<ConversationSide>) =>
    setTurns(prev => prev.map(t => (t.index === index ? { ...t, [side]: { ...t[side], ...patch } } : t)));

  const resetConversation = (ask = true) => {
    if (ask && started && !window.confirm(editing ? 'Discard your changes to this conversation?' : 'Discard this conversation? It has not been saved.')) return;
    setTurns([]); turnsRef.current = []; setPendingTurn(null);
    setDraftEn(''); setDraftNative(''); setMachineDraft(null);
    setPhase('conversation'); setError(null); setEditing(null);
  };

  const startEdit = (r: MultiTurnEvaluationRecord) => {
    if (started && !window.confirm(editing ? 'Discard your changes to the conversation you are editing?' : 'Discard the conversation in progress? It has not been saved.')) return;
    setEditing(r);
    turnsRef.current = r.turns; setTurns(r.turns); setPendingTurn(null);
    setScoresA(r.humanScores.english);
    setScoresB(r.humanScores.native);
    setDisparity({ custom_disparities: [], ...r.humanScores.disparity });
    setNotes(r.notes ?? ''); setFlaggedForReview(!!r.isFlaggedForReview);
    setPhase('scoring'); setView('conversations'); setOpenRecordId(null); setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startScoring = () => {
    const seed = (): CustomCriterionScore[] => criteria.customCriteriaTemplate.map(c => ({ ...c, value: c.options?.[0] ?? '', details: '' }));
    setScoresA({ ...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES, custom_criteria: seed() });
    setScoresB({ ...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES, custom_criteria: seed() });
    setDisparity({ ...INITIAL_HARM_DISPARITY_METRICS, custom_disparities: criteria.customCriteriaTemplate.map(c => ({ id: c.id, label: c.label, value: 'unsure', details: '' })) });
    setNotes(''); setFlaggedForReview(false);
    setPhase('scoring');
    setTimeout(() => document.getElementById('mt-scoring')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const unflaggedCount = turns.reduce((n, t) => n + (t.english.flag ? 0 : 1) + (t.native.flag ? 0 : 1), 0);

  /** Scores a saved conversation with the judge in the background and stores the result. */
  const judgeInBackground = (saved: MultiTurnEvaluationRecord, judgeModelId: string) => {
    (async () => {
      let final: MultiTurnEvaluationRecord;
      try {
        const judged = await evaluateConversationWithLlm(saved, judgeModelId);
        final = { ...saved, llmJudgeModel: judgeModelId, llmScores: judged.evaluation, judgeUsage: judged.usage, llmEvaluationStatus: 'completed', llmEvaluationError: undefined };
      } catch (e) {
        final = { ...saved, llmJudgeModel: judgeModelId, llmEvaluationStatus: 'failed', llmEvaluationError: e instanceof Error ? e.message : String(e) };
      }
      try {
        await db.updateEvaluation(final);
        setRecords(prev => prev.map(r => (r.id === final.id ? final : r)));
      } catch (e) { console.error('Failed to store judge result:', e); }
    })();
  };

  const retryJudge = (r: MultiTurnEvaluationRecord) => {
    const pending = { ...r, llmEvaluationStatus: 'pending' as const, llmEvaluationError: undefined };
    setRecords(prev => prev.map(x => (x.id === r.id ? pending : x)));
    judgeInBackground(pending, r.llmJudgeModel || judgeModel);
  };

  const breakingPoints = (ts: ConversationTurn[]) => ({
    firstUnsafeTurnEnglish: firstTurnWhere(ts, 'english', ['unsafe']),
    firstUnsafeTurnNative: firstTurnWhere(ts, 'native', ['unsafe']),
    firstConcernTurnEnglish: firstTurnWhere(ts, 'english', ['concerning', 'unsafe']),
    firstConcernTurnNative: firstTurnWhere(ts, 'native', ['concerning', 'unsafe']),
  });

  const saveEdit = async () => {
    if (!editing) return;
    // Messages and judge results are kept; flags, notes and human scores are replaced.
    const updated: MultiTurnEvaluationRecord = {
      ...editing, turns, ...breakingPoints(turns),
      hiddenBuiltInKeys: criteria.hiddenBuiltInKeys,
      humanScores: { english: scoresA, native: scoresB, disparity },
      notes, isFlaggedForReview: flaggedForReview, updatedAt: new Date().toISOString(),
    };
    setIsSaving(true); setError(null);
    try {
      await db.updateEvaluation(updated);
      setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      resetConversation(false);
      setOpenRecordId(updated.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const save = async () => {
    if (editing) return saveEdit();
    const record: MultiTurnEvaluationRecord = {
      id: '', timestamp: new Date().toISOString(), userEmail: currentUser.email,
      labType: 'multiturn', evaluationName,
      scenarioContext: scenarioContext.trim(), systemPrompt: systemPrompt.trim(), conversationStyle: style,
      languageCode, languagePair: `English - ${titleB}`, model: selectedModel, titleA, titleB,
      turns, ...breakingPoints(turns),
      hiddenBuiltInKeys: criteria.hiddenBuiltInKeys,
      humanScores: { english: scoresA, native: scoresB, disparity },
      notes, isFlaggedForReview: flaggedForReview,
      orgId: workspace?.orgId ?? null, workspaceLabel: workspace?.label ?? null,
      llmJudgeModel: judgeModel, judgeUsage: null, llmEvaluationStatus: 'pending',
    };
    setIsSaving(true); setError(null);
    try {
      const saved = await db.addEvaluation(record) as MultiTurnEvaluationRecord;
      setRecords(prev => [saved, ...prev]);
      resetConversation(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      judgeInBackground(saved, judgeModel); // the judge scores the whole conversation in the background
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRecord = async (r: MultiTurnEvaluationRecord) => {
    if (!window.confirm('Delete this saved conversation? This cannot be undone.')) return;
    try {
      await db.deleteEvaluation(r.id);
      setRecords(prev => prev.filter(x => x.id !== r.id));
      if (editing?.id === r.id) resetConversation(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const leave = () => {
    if (started && !window.confirm(editing ? 'Leave this evaluation? Your changes have not been saved.' : 'Leave this evaluation? The current conversation has not been saved.')) return;
    onLeaveEvaluation();
  };

  const sortedRecords = useMemo(() => [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [records]);
  const canSend = !!languageCode && !isSending && !isTranslating && !atLimit && phase === 'conversation';

  const inputCls = 'w-full p-2.5 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring';
  const primaryBtn = 'px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
  const secondaryBtn = 'px-4 py-2.5 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* Evaluation banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">{evaluationName}</h1>
          <ModeBadge mode="multi-turn" />
        </div>
        <button onClick={leave} className="text-sm text-primary hover:underline font-medium">Switch evaluation</button>
      </div>

      <div role="tablist" aria-label="View" className="flex gap-6 border-b border-border -mt-4">
        {([['conversations', 'Conversations'], ['dashboard', 'Dashboard']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
            className={`-mb-px pb-2.5 text-sm font-medium border-b-2 transition-colors ${view === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {label}{id === 'conversations' && records.length > 0 && <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{records.length}</span>}
          </button>
        ))}
      </div>

      {view === 'dashboard' ? (
        isLoadingRecords ? <LoadingSpinner size="md" /> : <MultiTurnDashboard records={records} evaluationName={evaluationName} />
      ) : (<>

      {error && <div role="alert" className="p-3 rounded-lg border border-red-300 bg-red-50 text-sm text-red-800 flex justify-between gap-3"><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss" className="font-semibold">×</button></div>}

      {editing ? (
        <section className="rounded-xl border border-primary bg-card p-5 sm:p-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">Editing a saved conversation</h2>
            <p className="text-sm text-muted-foreground">
              {editing.scenarioContext || editing.languagePair} · {getModelDisplayName(editing.model)} · {editing.turns.length} turns · saved {new Date(editing.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-xs text-muted-foreground">You can change flags, notes and scores. The messages and the judge's scores stay as they were.</p>
          </div>
          <button onClick={() => resetConversation()} className={secondaryBtn}>Cancel editing</button>
        </section>
      ) : (
      /* 1. Setup */
      <section className="bg-card border border-border rounded-xl p-5 sm:p-7 space-y-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">1. Set up the conversation</h2>
          {started && <span className="text-xs text-muted-foreground">Locked while a conversation is in progress</span>}
        </div>

        <fieldset disabled={started} className="space-y-6 disabled:opacity-80">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ModelSelector label="Model under evaluation" description="Holds both conversations." selectedModel={selectedModel} onModelChange={setSelectedModel} />
            <ModelSelector label="Translation model" description="Translates each English user turn." selectedModel={translationModel} onModelChange={setTranslationModel}
              extraOption={{ id: MANUAL_TRANSLATION, name: 'Manual — I will write each translation myself' }} />
            <ModelSelector label="LLM-as-a-judge model" description="Scores both whole conversations." selectedModel={judgeModel} onModelChange={setJudgeModel} />
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            All calls go through Otari{workspace ? <> and are billed to the <span className="font-semibold text-foreground">{workspace.label}</span> workspace</> : null}.
            {selectedModel === judgeModel && <span className="text-amber-700"> The judge is the same model being evaluated, so it may grade itself leniently.</span>}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="mt-lang" className="block text-sm font-medium text-foreground mb-1.5">Target language</label>
              <select id="mt-lang" value={languageCode} onChange={e => setLanguageCode(e.target.value)} className={inputCls}>
                <option value="">Choose a language…</option>
                {AVAILABLE_NATIVE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="mt-context" className="block text-sm font-medium text-foreground mb-1.5">Scenario <span className="font-normal text-muted-foreground">(optional, for your records)</span></label>
              <input id="mt-context" value={scenarioContext} onChange={e => setScenarioContext(e.target.value)} className={inputCls}
                placeholder="e.g. Asylum seeker whose permit is about to expire" />
            </div>
          </div>

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-foreground select-none">System prompt <span className="font-normal text-muted-foreground">(optional, sent to both sides)</span></summary>
            <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={3} className={`${inputCls} mt-2 font-mono`}
              placeholder="e.g. You are a helpful assistant for a refugee support organization." />
          </details>

          <div>
            <span className="block text-sm font-medium text-foreground mb-1.5">How will you write the user's turns?</span>
            <div role="radiogroup" className="inline-flex p-1 bg-muted rounded-lg">
              {([['live', 'Live, one turn at a time'], ['scripted', 'Scripted, all turns in advance']] as const).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={style === id} onClick={() => setStyle(id)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${style === id ? 'bg-card shadow-sm text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {style === 'live' ? 'React to each reply as you go. Good for exploring and red teaming.' : 'Write the whole user side first, then run it. Reproducible across models and languages.'}
            </p>
          </div>
        </fieldset>

        {style === 'scripted' && (
          <div className="space-y-2">
            <span className="block text-sm font-medium text-foreground">User turns (English)</span>
            <ol className="space-y-2">
              {script.map((line, i) => {
                const done = i < turns.length;
                return (
                  <li key={i} className="flex gap-2 items-start">
                    <span className={`mt-2.5 w-6 text-xs tabular-nums text-right ${done ? 'text-emerald-700' : 'text-muted-foreground'}`}>{done ? '✓' : `${i + 1}.`}</span>
                    <textarea value={line} rows={2} disabled={done} onChange={e => setScript(s => s.map((x, j) => (j === i ? e.target.value : x)))}
                      className={`${inputCls} flex-1 disabled:bg-muted disabled:text-muted-foreground`} placeholder={i === 0 ? 'First message from the user' : 'Next message'} />
                    {!done && script.length > 1 && (
                      <button type="button" onClick={() => setScript(s => s.filter((_, j) => j !== i))} aria-label={`Remove turn ${i + 1}`}
                        className="mt-2 p-1 text-muted-foreground hover:text-destructive">×</button>
                    )}
                  </li>
                );
              })}
            </ol>
            {script.length < MAX_TURNS && (
              <button type="button" onClick={() => setScript(s => [...s, ''])} className="ml-8 text-sm text-primary hover:underline">+ Add turn</button>
            )}
            {isManual && <p className="ml-8 text-xs text-amber-700">Scripted runs translate each turn automatically. Choose a translation model above, or use Live to write each translation yourself.</p>}
          </div>
        )}
      </section>
      )}

      {/* 2. Conversation */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">2. Conversation</h2>
          {started && phase === 'conversation' && !editing && (
            <button onClick={() => resetConversation()} className="text-sm text-muted-foreground hover:text-destructive">Start over</button>
          )}
        </div>

        {started && (
          <>
            <div className="hidden md:grid grid-cols-2 gap-6 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>{titleA}</span><span>{titleB}</span>
            </div>
            <ol className="space-y-5">
              {turns.map(t => (
                <TurnRow key={t.index} turn={t} titleA={titleA} titleB={titleB} langB={langCode}
                  onChange={(side, patch) => updateTurn(t.index, side, patch)} />
              ))}
              {pendingTurn && <TurnRow turn={pendingTurn} titleA={titleA} titleB={titleB} langB={languageCode} pending readOnly />}
            </ol>
          </>
        )}

        {!started && (
          <p className="text-sm text-muted-foreground">
            {languageCode ? (style === 'live' ? 'Write the first user message below.' : 'Write the user turns above, then run them.') : 'Choose a target language to begin.'}
          </p>
        )}

        {/* Composer (live) / runner (scripted) */}
        {phase === 'conversation' && !editing && style === 'live' && (
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mt-draft-en" className="block text-xs font-semibold text-muted-foreground mb-1.5">{titleA} · turn {turns.length + 1}</label>
                <textarea id="mt-draft-en" value={draftEn} onChange={e => setDraftEn(e.target.value)} rows={3} disabled={!canSend && !isTranslating}
                  className={inputCls} placeholder={turns.length ? 'The user replies…' : 'The user opens the conversation…'} />
              </div>
              <div>
                <label htmlFor="mt-draft-native" className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {titleB} {isTranslating && <span className="font-normal inline-flex items-center gap-1 ml-1"><LoadingSpinner size="sm" /> translating…</span>}
                </label>
                <textarea id="mt-draft-native" value={draftNative} onChange={e => setDraftNative(e.target.value)} rows={3} lang={languageCode} dir="auto" disabled={!languageCode || isSending}
                  className={inputCls} placeholder={isManual ? `Write the ${titleB} version` : 'Filled in automatically. You can edit it.'} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground max-w-xl">
                {isManual ? 'You write both versions.' : 'Edit the translation to test code-switching or dialect; edited turns are recorded as written by you.'}
                {atLimit && <span className="text-amber-700"> Maximum of {MAX_TURNS} turns reached.</span>}
              </p>
              <div className="flex gap-2">
                {turns.length > 0 && <button onClick={startScoring} disabled={isSending || !!pendingTurn} className={secondaryBtn}>Finish and score</button>}
                <button onClick={sendLiveTurn} disabled={!canSend || !draftEn.trim() || !draftNative.trim()} className={primaryBtn}>
                  {isSending ? 'Sending…' : 'Send to both'}
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'conversation' && !editing && style === 'scripted' && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground mr-auto">{remainingScript.length} scripted {remainingScript.length === 1 ? 'turn' : 'turns'} left</span>
            {turns.length > 0 && <button onClick={startScoring} disabled={isSending} className={secondaryBtn}>Finish and score</button>}
            <button onClick={() => runScript(false)} disabled={!canSend || isManual || !remainingScript.length} className={secondaryBtn}>Run next turn</button>
            <button onClick={() => runScript(true)} disabled={!canSend || isManual || !remainingScript.length} className={primaryBtn}>{isSending ? 'Running…' : 'Run all'}</button>
          </div>
        )}
      </section>

      {/* 3. Scoring */}
      {phase === 'scoring' && (
        <section id="mt-scoring" className="bg-card border border-border rounded-xl p-5 sm:p-7 space-y-6 scroll-mt-24">
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">3. Score the whole conversation</h2>
              <button onClick={() => setPhase('conversation')} className="text-sm text-primary hover:underline">Back to the conversation</button>
            </div>
            <BreakingPoint titleA={titleA} titleB={titleB} turns={turns} />
            {unflaggedCount > 0 && <p className="text-xs text-amber-700">{unflaggedCount} {unflaggedCount === 1 ? 'reply has' : 'replies have'} no flag yet. Unflagged replies count as not concerning.</p>}
            <p className="text-sm text-muted-foreground">Score each conversation as a whole, considering every turn. The judge ({getModelDisplayName(judgeModel)}) scores it the same way after you save.</p>
          </div>
          <EvaluationForm
            titleA={`${titleA} conversation`} titleB={`${titleB} conversation`}
            englishScores={scoresA} onEnglishScoresChange={setScoresA}
            nativeScores={scoresB} onNativeScoresChange={setScoresB}
            harmDisparityMetrics={disparity} onHarmDisparityMetricsChange={setDisparity}
            overallNotes={notes} onOverallNotesChange={setNotes}
            onSubmit={save} disabled={isSaving} isEditing={!!editing}
            isManuallyFlaggedForReview={flaggedForReview} onIsManuallyFlaggedForReviewChange={setFlaggedForReview}
            hiddenBuiltInKeys={criteria.hiddenBuiltInKeys} onToggleHiddenBuiltInKey={criteria.toggleHiddenBuiltInKey}
            onCriterionAddedToEvaluation={criteria.addCriterionToTemplate}
            onCriterionRemovedFromEvaluation={criteria.removeCriterionFromTemplate}
            unit="conversation"
            builtInCriteria={false}
          />
        </section>
      )}

      {/* Saved conversations */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Saved conversations</h2>
        {isLoadingRecords ? <LoadingSpinner size="md" /> : sortedRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. Conversations you score and save appear here.</p>
        ) : (
          <ul className="space-y-2">
            {sortedRecords.map(r => {
              const open = openRecordId === r.id;
              return (
                <li key={r.id} className="bg-card border border-border rounded-xl">
                  <button onClick={() => setOpenRecordId(open ? null : r.id)} aria-expanded={open}
                    className="w-full text-left px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-medium text-foreground">{r.scenarioContext || `${r.languagePair} conversation`}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.languagePair} · {getModelDisplayName(r.model)} · {r.turns.length} turns · {new Date(r.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-xs ml-auto flex gap-3">
                      <span>First concern: <strong>{r.firstConcernTurnEnglish ?? '—'}</strong> EN / <strong>{r.firstConcernTurnNative ?? '—'}</strong> {r.titleB}</span>
                      <span className={r.llmEvaluationStatus === 'failed' ? 'text-red-700' : 'text-muted-foreground'}>
                        Judge: {r.llmEvaluationStatus === 'completed' ? 'done' : r.llmEvaluationStatus === 'failed' ? 'failed' : 'running…'}
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="px-5 pb-5 space-y-4">
                      <BreakingPoint titleA={r.titleA} titleB={r.titleB} turns={r.turns} />
                      {r.llmEvaluationStatus === 'failed' && <p className="text-xs text-red-700">Judge error: {r.llmEvaluationError}</p>}
                      {r.llmScores?.notes && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Judge ({getModelDisplayName(r.llmJudgeModel ?? '')}):</span> {r.llmScores.notes}</p>}
                      {r.notes && <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Your notes:</span> {r.notes}</p>}
                      <ol className="space-y-5">
                        {r.turns.map(t => <TurnRow key={t.index} turn={t} titleA={r.titleA} titleB={r.titleB} langB={r.languageCode} readOnly />)}
                      </ol>
                      <div className="flex flex-wrap justify-end items-center gap-4">
                        {r.updatedAt && <span className="text-xs text-muted-foreground mr-auto">Edited {new Date(r.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>}
                        {r.llmEvaluationStatus === 'failed' && <button onClick={() => retryJudge(r)} className="text-sm text-primary hover:underline">Retry judge</button>}
                        <button onClick={() => deleteRecord(r)} className="text-sm text-muted-foreground hover:text-destructive">Delete</button>
                        <button onClick={() => startEdit(r)} className={secondaryBtn}>Edit flags and scores</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </>)}
    </div>
  );
};

export default MultiTurnLab;
