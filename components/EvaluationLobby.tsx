import React, { useState, useEffect } from 'react';
import { User, EvaluationMode, modeOfLabType } from '../types';
import * as db from '../services/databaseService';
import LoadingSpinner from './LoadingSpinner';
import { EVALUATION_MODES, ModeBadge, ModeIcon } from './EvaluationModes';

interface EvaluationLobbyProps {
  currentUser: User;
  onEnter: (evaluationName: string, mode: EvaluationMode) => void;
}

type EvaluationGroup = { key: string; name: string; mode: EvaluationMode; count: number; lastUsed: string; ids: string[] };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const EvaluationLobby: React.FC<EvaluationLobbyProps> = ({ currentUser, onEnter }) => {
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<EvaluationMode>('single-turn');
  const [existingNames, setExistingNames] = useState<EvaluationGroup[]>([]);
  const [unnamed, setUnnamed] = useState<{ ids: string[]; count: number; lastUsed: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNamingUnnamed, setIsNamingUnnamed] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const evaluations = await db.getEvaluations(currentUser);
        // An evaluation is identified by its name AND its mode: the same name used in two
        // modes is two separate evaluations, so their records never mix.
        const groups = new Map<string, EvaluationGroup>();
        const unnamedIds: string[] = [];
        let unnamedLastUsed = '';
        for (const ev of evaluations) {
          const mode = modeOfLabType(ev.labType);
          if (!mode) continue;
          const name = (ev as { evaluationName?: string }).evaluationName;
          if (!name) {
            // Only legacy single-turn records can be unnamed.
            if (mode === 'single-turn') {
              unnamedIds.push(ev.id);
              if (ev.timestamp > unnamedLastUsed) unnamedLastUsed = ev.timestamp;
            }
            continue;
          }
          const key = `${mode}::${name}`;
          const g = groups.get(key) ?? { key, name, mode, count: 0, lastUsed: '', ids: [] };
          g.count += 1;
          g.ids.push(ev.id);
          if (ev.timestamp > g.lastUsed) g.lastUsed = ev.timestamp;
          groups.set(key, g);
        }
        const sorted = Array.from(groups.values()).sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
        setExistingNames(sorted);
        setUnnamed(unnamedIds.length > 0 ? { ids: unnamedIds, count: unnamedIds.length, lastUsed: unnamedLastUsed } : null);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const handleEnter = () => {
    const trimmed = newName.trim();
    if (trimmed) onEnter(trimmed, newMode);
  };

  // Unnamed records can't be entered as-is (there's no real name to filter by),
  // so ask for a name up front, rename them in the database, then continue in.
  const handleContinueUnnamed = async () => {
    if (!unnamed) return;
    const proposed = window.prompt(
      `This evaluation has ${unnamed.count} ${unnamed.count === 1 ? 'entry' : 'entries'} but no name yet. Give it a name to continue:`
    );
    if (proposed === null) return; // cancelled
    const trimmed = proposed.trim();
    if (!trimmed) {
      alert('Name cannot be empty.');
      return;
    }
    setIsNamingUnnamed(true);
    try {
      const { succeededIds, failed } = await db.renameEvaluationGroup(unnamed.ids, trimmed);
      if (failed.length > 0) {
        console.error('Some records failed to rename:', failed);
        if (succeededIds.length === 0) {
          alert(
            `Failed to name any of the ${unnamed.count} entries. First error: ${failed[0].error}\n\n` +
            `Open the browser console for the full list. Nothing was changed.`
          );
          setIsNamingUnnamed(false);
          return;
        }
        alert(
          `Named ${succeededIds.length} of ${unnamed.count} entries as "${trimmed}". ` +
          `${failed.length} failed (first error: ${failed[0].error}) — see console for details. ` +
          `Continuing with the ones that succeeded; the rest are still "Untitled" and can be retried.`
        );
      }
      onEnter(trimmed, 'single-turn');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      alert(`Failed to name this evaluation: ${message}`);
      console.error('Failed to rename unnamed evaluations from lobby:', e);
      setIsNamingUnnamed(false);
    }
  };

  // Permanently deletes every record under a named evaluation. Available here to whoever
  // can see it in this list: non-admins only ever see evaluations they've contributed to
  // (db.getEvaluations already scopes non-admin queries to their own userEmail), and admins
  // see everything — so no extra ownership check is needed on top of that existing scoping.
  const handleDeleteEvaluationGroup = async ({ key, name, ids }: EvaluationGroup) => {
    if (!window.confirm(
      `Permanently delete the evaluation "${name}" and all ${ids.length} ${ids.length === 1 ? 'entry' : 'entries'} in it?\n\n` +
      `This cannot be undone.`
    )) {
      return;
    }
    setDeletingName(key);
    try {
      const { succeededIds, failed } = await db.deleteEvaluationGroup(ids);
      if (failed.length > 0) {
        console.error('Some records failed to delete:', failed);
        alert(
          `Deleted ${succeededIds.length} of ${ids.length} entries in "${name}". ` +
          `${failed.length} failed (first error: ${failed[0].error}) — see console for details.`
        );
      }
      setExistingNames(prev => {
        const remainingIds = ids.filter(id => !succeededIds.includes(id));
        if (remainingIds.length === 0) return prev.filter(e => e.key !== key);
        return prev.map(e => e.key === key ? { ...e, ids: remainingIds, count: remainingIds.length } : e);
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      alert(`Failed to delete "${name}": ${message}`);
      console.error('Failed to delete evaluation group from lobby:', e);
    } finally {
      setDeletingName(null);
    }
  };

  const hasExisting = existingNames.length > 0 || !!unnamed;

  return (
      <main className="flex-grow px-4 pt-14 sm:pt-20 pb-24">
        <div className="w-full max-w-xl mx-auto">
          <div className="mb-10">
            <h1 className="text-[28px] sm:text-3xl font-semibold text-foreground tracking-tight">
              {hasExisting ? 'Welcome back' : 'Welcome'}
            </h1>
            <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
              {hasExisting
                ? 'Pick up where you left off, or start a new evaluation.'
                : 'Start by naming your evaluation. Its scenarios, criteria and results are kept together under that name.'}
            </p>
          </div>

          {/* Existing evaluations */}
          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
          ) : existingNames.length > 0 || unnamed ? (
            <div className="mb-10">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-3">
                Your evaluations
              </h2>
              <div className="space-y-2">
                {existingNames.map(group => {
                  const { key, name, mode, count, lastUsed } = group;
                  return (
                  <div key={key} className="relative group">
                    <button
                      onClick={() => onEnter(name, mode)}
                      disabled={deletingName === key}
                      className="w-full text-left px-5 py-4 pr-14 bg-card border border-border rounded-xl hover:border-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-wait"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {name}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                        <ModeBadge mode={mode} />
                        <span>{count.toLocaleString()} {count === 1 ? 'entry' : 'entries'} · Last used {formatDate(lastUsed)}</span>
                      </p>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEvaluationGroup(group); }}
                      disabled={deletingName === key}
                      aria-label={`Delete evaluation "${name}"`}
                      title="Delete this evaluation"
                      className="absolute top-1/2 -translate-y-1/2 right-3 p-2 rounded-md text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:bg-red-50 hover:text-destructive transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    >
                      {deletingName === key ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                  );
                })}
                {unnamed && (
                  <button
                    onClick={handleContinueUnnamed}
                    disabled={isNamingUnnamed}
                    className="w-full text-left px-5 py-4 bg-card border border-dashed border-border rounded-xl hover:border-primary transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-wait"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                        Untitled
                      </span>
                      {isNamingUnnamed ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {unnamed.count} {unnamed.count === 1 ? 'entry' : 'entries'} without a name · Click to name and continue
                    </p>
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {/* New evaluation: name + mode */}
          <form onSubmit={e => { e.preventDefault(); handleEnter(); }}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-3">
              {hasExisting ? 'Start a new evaluation' : 'Start your first evaluation'}
            </h2>

            <fieldset>
              <legend className="text-sm font-medium text-foreground mb-2">What do you want to evaluate?</legend>
              <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {EVALUATION_MODES.map(m => {
                  const selected = newMode === m.id;
                  return (
                    <label
                      key={m.id}
                      className={`relative flex gap-3 p-4 rounded-xl border transition-colors ${
                        m.available
                          ? `cursor-pointer bg-card ${selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-gray-400'}`
                          : 'cursor-not-allowed bg-muted border-border opacity-70'
                      }`}
                    >
                      <input
                        type="radio" name="evaluation-mode" value={m.id} className="sr-only"
                        checked={selected} disabled={!m.available} onChange={() => setNewMode(m.id)}
                      />
                      <ModeIcon mode={m.id} className={`w-5 h-5 mt-0.5 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{m.label}</span>
                          {!m.available && <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">Soon</span>}
                        </span>
                        <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{m.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label htmlFor="new-evaluation-name" className="block text-sm font-medium text-foreground mt-6 mb-2">Name it</label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="new-evaluation-name"
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Farsi health questions, Spring review"
                className="flex-grow px-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-[15px] placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={!newName.trim()}
                className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Start
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">An evaluation keeps one mode, so results from different modes never mix.</p>
          </form>
        </div>
      </main>
  );
};

export default EvaluationLobby;
