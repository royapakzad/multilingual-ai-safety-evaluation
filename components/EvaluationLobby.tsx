import React, { useState, useEffect } from 'react';
import { User, ReasoningEvaluationRecord } from '../types';
import * as db from '../services/databaseService';
import LoadingSpinner from './LoadingSpinner';

interface EvaluationLobbyProps {
  currentUser: User;
  onEnter: (evaluationName: string) => void;
  onLogout: () => void;
  onChangePassword?: () => void;
  onOpenAccessRequests?: () => void;
}

const EvaluationLobby: React.FC<EvaluationLobbyProps> = ({ currentUser, onEnter, onLogout, onChangePassword, onOpenAccessRequests }) => {
  const [newName, setNewName] = useState('');
  const [existingNames, setExistingNames] = useState<{ name: string; count: number; lastUsed: string }[]>([]);
  const [unnamed, setUnnamed] = useState<{ ids: string[]; count: number; lastUsed: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNamingUnnamed, setIsNamingUnnamed] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const evaluations = await db.getEvaluations(currentUser);
        const reasoningEvals = evaluations.filter(
          (e): e is ReasoningEvaluationRecord => e.labType === 'reasoning'
        );
        const nameMap = new Map<string, { count: number; lastUsed: string }>();
        const unnamedIds: string[] = [];
        let unnamedLastUsed = '';
        for (const ev of reasoningEvals) {
          const name = ev.evaluationName;
          if (!name) {
            unnamedIds.push(ev.id);
            if (ev.timestamp > unnamedLastUsed) unnamedLastUsed = ev.timestamp;
            continue;
          }
          const existing = nameMap.get(name);
          if (!existing || ev.timestamp > existing.lastUsed) {
            nameMap.set(name, {
              count: (existing?.count ?? 0) + 1,
              lastUsed: ev.timestamp,
            });
          } else {
            nameMap.set(name, { ...existing, count: existing.count + 1 });
          }
        }
        const sorted = Array.from(nameMap.entries())
          .map(([name, meta]) => ({ name, ...meta }))
          .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
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
    if (trimmed) onEnter(trimmed);
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
      onEnter(trimmed);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      alert(`Failed to name this evaluation: ${message}`);
      console.error('Failed to rename unnamed evaluations from lobby:', e);
      setIsNamingUnnamed(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg text-primary">LLM Evaluation Labs</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{currentUser.email}</span>
          {currentUser.role === 'admin' && onOpenAccessRequests && (
            <button
              onClick={onOpenAccessRequests}
              className="text-sm text-primary hover:underline transition-colors"
            >
              Access Requests
            </button>
          )}
          {onChangePassword && (
            <button
              onClick={onChangePassword}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Change Password
            </button>
          )}
          <button
            onClick={onLogout}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-grow flex items-start justify-center px-4 pt-16 pb-20">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              {existingNames.length > 0 || unnamed ? 'Welcome back' : 'Welcome'}
            </h1>
            <p className="text-muted-foreground mt-2 text-base">
              Give your evaluation a name to keep results organized and separate.
            </p>
          </div>

          {/* Existing evaluations */}
          {isLoading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
          ) : existingNames.length > 0 || unnamed ? (
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Continue an evaluation
              </h2>
              <div className="space-y-2">
                {existingNames.map(({ name, count, lastUsed }) => (
                  <button
                    key={name}
                    onClick={() => onEnter(name)}
                    className="w-full text-left px-5 py-4 bg-card border border-border rounded-xl shadow-sm hover:border-primary hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {name}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {count} {count === 1 ? 'entry' : 'entries'} · Last used {new Date(lastUsed).toLocaleDateString()}
                    </p>
                  </button>
                ))}
                {unnamed && (
                  <button
                    onClick={handleContinueUnnamed}
                    disabled={isNamingUnnamed}
                    className="w-full text-left px-5 py-4 bg-card border border-dashed border-border rounded-xl shadow-sm hover:border-primary hover:shadow-md transition-all group disabled:opacity-60 disabled:cursor-wait"
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

          {/* New evaluation */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {existingNames.length > 0 || unnamed ? 'Or start a new evaluation' : 'Name your evaluation'}
            </h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEnter()}
                placeholder="e.g., Spanish Safety Review – April 2025"
                className="flex-grow px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                autoFocus
              />
              <button
                onClick={handleEnter}
                disabled={!newName.trim()}
                className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                Enter Lab
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EvaluationLobby;
