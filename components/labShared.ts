// Small hooks shared by the mode labs. Each lab passes its own storage scope, so settings
// saved in one mode (e.g. removed rubric dimensions) never leak into another.

import { useCallback, useEffect, useState } from 'react';
import { CustomCriterionScore } from '../types';
import { HIDDEN_BUILT_IN_CRITERIA_KEY_PREFIX, CUSTOM_CRITERIA_TEMPLATE_KEY_PREFIX, ALL_BUILT_IN_KEYS } from '../constants';

/** Translation-picker option meaning "no machine translation: the evaluator writes it". */
export const MANUAL_TRANSLATION = 'manual';

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return parsed ?? fallback;
  } catch { return fallback; }
};
const writeJson = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

/** A model choice remembered in this browser across sessions. */
export const usePersistedModel = (storageKey: string, fallback: string) => {
  const [value, setValue] = useState<string>(() => {
    try { return localStorage.getItem(storageKey) || fallback; } catch { return fallback; }
  });
  const set = useCallback((next: string) => {
    setValue(next);
    try { localStorage.setItem(storageKey, next); } catch { /* storage unavailable */ }
  }, [storageKey]);
  return [value, set] as const;
};

/**
 * Per-evaluation rubric configuration: which built-in dimensions were removed, and the
 * running template of custom criteria (defined once, carried into every new entry).
 * `scope` keeps different modes' evaluations apart even when they share a name.
 */
export const useEvaluationCriteria = (
  scope: string,
  { defaultCriteria = [], builtIns = true }: { defaultCriteria?: CustomCriterionScore[]; builtIns?: boolean } = {},
) => {
  const hiddenKey = `${HIDDEN_BUILT_IN_CRITERIA_KEY_PREFIX}${scope}`;
  const templateKey = `${CUSTOM_CRITERIA_TEMPLATE_KEY_PREFIX}${scope}`;
  const [hiddenBuiltInKeys, setHidden] = useState<string[]>([]);
  const [customCriteriaTemplate, setTemplate] = useState<CustomCriterionScore[]>([]);

  useEffect(() => {
    const h = readJson<unknown>(hiddenKey, []);
    // A brand-new evaluation starts with the mode's default criteria; once the template has been
    // saved (even emptied by the evaluator), it is used as-is.
    let stored: string | null = null;
    try { stored = localStorage.getItem(templateKey); } catch { /* storage unavailable */ }
    const t = stored === null ? defaultCriteria : readJson<unknown>(templateKey, []);
    if (stored === null && defaultCriteria.length) writeJson(templateKey, defaultCriteria);
    // Modes without built-in criteria always hide all of them; nothing to toggle.
    setHidden(builtIns ? (Array.isArray(h) ? h : []) : ALL_BUILT_IN_KEYS);
    setTemplate(Array.isArray(t) ? t : []);
  }, [hiddenKey, templateKey]);

  const toggleHiddenBuiltInKey = (key: string, hide: boolean) =>
    builtIns && setHidden(prev => {
      const next = hide ? [...new Set([...prev, key])] : prev.filter(k => k !== key);
      writeJson(hiddenKey, next);
      return next;
    });
  const addCriterionToTemplate = (criterion: CustomCriterionScore) =>
    setTemplate(prev => { const next = [...prev, criterion]; writeJson(templateKey, next); return next; });
  const removeCriterionFromTemplate = (id: string) =>
    setTemplate(prev => { const next = prev.filter(c => c.id !== id); writeJson(templateKey, next); return next; });

  return { hiddenBuiltInKeys, toggleHiddenBuiltInKey, customCriteriaTemplate, addCriterionToTemplate, removeCriterionFromTemplate };
};
