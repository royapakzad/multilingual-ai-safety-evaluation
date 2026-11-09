import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ModelDefinition, ModelLicense } from '../types';
import { fetchGatewayModels } from '../services/llmService';
import { SUGGESTED_MODELS, classifyModelLicense, getModelDisplayName } from '../constants';

interface ModelSelectorProps {
  label: string;
  description?: string;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  /** Extra non-model option at the top, e.g. "Manual translation". */
  extraOption?: { id: string; name: string };
  /** Smaller label and button, with the list floating over the page (for settings bars). */
  compact?: boolean;
}

const LicenseBadge: React.FC<{ license?: ModelLicense }> = ({ license }) => {
  if (license === 'open-weight') return <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Open weights</span>;
  if (license === 'proprietary') return <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">Proprietary</span>;
  return null;
};

const GROUPS: { key: 'suggested' | ModelLicense; title: string }[] = [
  { key: 'suggested', title: 'Suggested' },
  { key: 'open-weight', title: 'Open-weight models' },
  { key: 'proprietary', title: 'Proprietary models' },
  { key: 'unknown', title: 'Other models' },
];

/**
 * Searchable model picker backed by the Otari gateway: lists exactly the models the user's
 * organization key is allowed to call. Used three times — model under evaluation, translation
 * model, and LLM-as-a-judge model.
 */
const ModelSelector: React.FC<ModelSelectorProps> = ({ label, description, selectedModel, onModelChange, extraOption, compact }) => {
  const [search, setSearch] = useState('');
  const [gatewayModels, setGatewayModels] = useState<ModelDefinition[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGatewayModels()
      .then(models => setGatewayModels(models))
      .catch(err => { setLoadError(err instanceof Error ? err.message : String(err)); setGatewayModels([]); });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loading = gatewayModels === null;
  const liveIds = useMemo(() => new Set((gatewayModels ?? []).map(m => m.id)), [gatewayModels]);
  const liveListAvailable = !loading && !loadError && liveIds.size > 0;

  // Suggested models are shown only if the live list confirms the org key can use them —
  // or, if the live list could not be loaded, as an unverified fallback.
  const suggested = SUGGESTED_MODELS.filter(m => !liveListAvailable || liveIds.has(m.id));
  const suggestedIds = new Set(suggested.map(m => m.id));
  const others = (gatewayModels ?? []).filter(m => !suggestedIds.has(m.id));

  const query = search.toLowerCase();
  const matches = (m: ModelDefinition) => !query || m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query);

  const grouped: Record<string, ModelDefinition[]> = {
    suggested: suggested.filter(matches),
    'open-weight': others.filter(m => (m.license ?? classifyModelLicense(m.id)) === 'open-weight').filter(matches),
    proprietary: others.filter(m => (m.license ?? classifyModelLicense(m.id)) === 'proprietary').filter(matches),
    unknown: others.filter(m => (m.license ?? classifyModelLicense(m.id)) === 'unknown').filter(matches),
  };
  const totalShown = Object.values(grouped).reduce((n, g) => n + g.length, 0);

  const displayName = extraOption && selectedModel === extraOption.id ? extraOption.name : getModelDisplayName(selectedModel);
  const selectedLicense = extraOption && selectedModel === extraOption.id ? undefined : classifyModelLicense(selectedModel);
  const notInLiveList = liveListAvailable && selectedModel && !liveIds.has(selectedModel) && selectedModel !== extraOption?.id;

  const handleSelect = (modelId: string) => {
    onModelChange(modelId);
    setOpen(false);
    setSearch('');
  };

  const option = (model: ModelDefinition) => (
    <button
      key={model.id}
      type="button"
      role="option"
      aria-selected={selectedModel === model.id}
      onClick={() => handleSelect(model.id)}
      className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-primary/10 ${selectedModel === model.id ? 'bg-primary/15 text-primary font-medium' : 'text-card-foreground'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{model.name}</span>
        <LicenseBadge license={model.license ?? classifyModelLicense(model.id)} />
      </div>
      <div className="text-xs text-muted-foreground truncate font-mono">{model.id}</div>
    </button>
  );

  return (
    <div ref={containerRef} className={compact ? 'relative' : undefined}>
      {compact
        ? <span className="block text-xs font-medium text-muted-foreground mb-1" title={description}>{label}</span>
        : <h3 className="text-sm font-semibold text-foreground mb-1">{label}</h3>}
      {description && !compact && <p className="text-xs text-muted-foreground mb-2">{description}</p>}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 ${compact ? 'px-2.5 py-2' : 'p-3'} border border-border rounded-lg bg-card hover:bg-muted transition-colors text-sm font-medium text-card-foreground`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{displayName || 'Select a model...'}</span>
        <span className="flex items-center gap-2 flex-shrink-0">
          {!compact && <LicenseBadge license={selectedLicense} />}
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {notInLiveList && (
        <p className="text-xs text-amber-700 mt-1">This model is not in your organization's Otari model list — calls may be rejected.</p>
      )}

      {open && (
        <div className={`mt-1 border border-border rounded-lg bg-card shadow-lg z-50 ${compact ? 'absolute left-0 top-full w-[22rem] max-w-[90vw]' : 'relative'}`}>
          <div className="p-2 border-b border-border">
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto" role="listbox">
            {extraOption && (!query || extraOption.name.toLowerCase().includes(query)) && (
              <button
                type="button"
                role="option"
                aria-selected={selectedModel === extraOption.id}
                onClick={() => handleSelect(extraOption.id)}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-primary/10 ${selectedModel === extraOption.id ? 'bg-primary/15 text-primary font-medium' : 'text-card-foreground'}`}
              >
                {extraOption.name}
              </button>
            )}

            {GROUPS.map(({ key, title }) => grouped[key].length > 0 && (
              <div key={key}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50">
                  {title} ({grouped[key].length})
                </div>
                {grouped[key].map(option)}
              </div>
            ))}

            {loading && (
              <div className="px-3 py-3 text-sm text-muted-foreground flex items-center gap-2">
                <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full"></div>
                Loading models available to your organization via Otari...
              </div>
            )}
            {loadError && (
              <div className="px-3 py-2 text-xs text-destructive">
                Could not load your Otari model list ({loadError}). Showing suggested models, unverified.
              </div>
            )}
            {!loading && totalShown === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground">No models match your search.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
