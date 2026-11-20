import React from 'react';
import { EvaluationMode } from '../types';

export interface EvaluationModeInfo {
  id: EvaluationMode;
  label: string;
  description: string;
  available: boolean;
}

/** The modes offered when creating an evaluation, in display order. */
export const EVALUATION_MODES: EvaluationModeInfo[] = [
  { id: 'single-turn', label: 'Single prompt', available: true,
    description: 'One prompt, answered in English and in the target language, compared side by side.' },
  { id: 'multi-turn', label: 'Conversation', available: true,
    description: 'A multi-turn conversation held in both languages. Find the turn where safety breaks down.' },
  { id: 'voice', label: 'Voice', available: false,
    description: 'Spoken prompts and answers: transcription, response and speech quality.' },
  { id: 'agentic', label: 'Web research agent', available: true,
    description: 'An agent that searches the web: its queries, the sources it picks and how it cites them.' },
];

export const modeInfo = (mode: EvaluationMode) => EVALUATION_MODES.find(m => m.id === mode)!;

export const ModeIcon: React.FC<{ mode: EvaluationMode; className?: string }> = ({ mode, className = 'w-4 h-4' }) => {
  const common = { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className, 'aria-hidden': true };
  switch (mode) {
    case 'single-turn':
      return <svg {...common}><rect x="3" y="4" width="14" height="10" rx="2" /><path d="M7 14v3l3-3" /></svg>;
    case 'multi-turn':
      return <svg {...common}><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h7A1.5 1.5 0 0 1 13 5.5v4A1.5 1.5 0 0 1 11.5 11H7l-2.5 2v-2A1.5 1.5 0 0 1 3 9.5z" /><path d="M15.5 8H16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-.5v2L13 14H9.5" /></svg>;
    case 'voice':
      return <svg {...common}><rect x="7.5" y="2.5" width="5" height="9" rx="2.5" /><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" /></svg>;
    case 'agentic':
      return <svg {...common}><circle cx="8.5" cy="8.5" r="5" /><path d="m12.5 12.5 4 4M6.5 8.5h4M8.5 6.5v4" /></svg>;
  }
};

/** Small label naming an evaluation's mode, e.g. in the evaluations list and lab banner. */
export const ModeBadge: React.FC<{ mode: EvaluationMode }> = ({ mode }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground bg-muted border border-border rounded-md px-1.5 py-0.5">
    <ModeIcon mode={mode} className="w-3.5 h-3.5 text-muted-foreground" />
    {modeInfo(mode).label}
  </span>
);
