import React, { useState, useEffect, useRef } from 'react';
import { ModelDefinition } from '../types';
import { fetchOpenRouterModels } from '../services/llmService';
import { AVAILABLE_MODELS } from '../constants';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange }) => {
  const [search, setSearch] = useState('');
  const [openRouterModels, setOpenRouterModels] = useState<ModelDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOpenRouterModels().then(models => {
      setOpenRouterModels(models);
      setLoading(false);
    });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const staticModels = AVAILABLE_MODELS;
  const allModels: ModelDefinition[] = [...staticModels, ...openRouterModels];

  const query = search.toLowerCase();
  const filtered = query
    ? allModels.filter(m => m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query))
    : allModels;

  // Group filtered models
  const staticFiltered = filtered.filter(m => m.provider !== 'openrouter');
  const openrouterFiltered = filtered.filter(m => m.provider === 'openrouter');

  const selectedModelDef = allModels.find(m => m.id === selectedModel);
  const displayName = selectedModelDef?.name ?? selectedModel;

  const handleSelect = (modelId: string) => {
    onModelChange(modelId);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef}>
      <h3 className="text-md font-semibold text-foreground mb-3">Language Model</h3>

      {/* Selected model display / trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-3 border border-border rounded-lg bg-card hover:bg-muted transition-colors text-sm font-medium text-card-foreground"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{displayName || 'Select a model...'}</span>
        <svg className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-1 border border-border rounded-lg bg-card shadow-lg z-50 relative">
          {/* Search input */}
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

          {/* Model list */}
          <div className="max-h-72 overflow-y-auto" role="listbox">
            {/* Static models */}
            {staticFiltered.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50">
                  Built-in Models
                </div>
                {staticFiltered.map(model => (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={selectedModel === model.id}
                    onClick={() => handleSelect(model.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-primary/10
                      ${selectedModel === model.id ? 'bg-primary/15 text-primary font-medium' : 'text-card-foreground'}`}
                  >
                    {model.name}
                  </button>
                ))}
              </>
            )}

            {/* OpenRouter models */}
            {loading && (
              <div className="px-3 py-3 text-sm text-muted-foreground flex items-center gap-2">
                <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full"></div>
                Loading OpenRouter models...
              </div>
            )}
            {!loading && openrouterFiltered.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/50">
                  OpenRouter Models ({openRouterModels.length})
                </div>
                {openrouterFiltered.map(model => (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={selectedModel === model.id}
                    onClick={() => handleSelect(model.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-primary/10
                      ${selectedModel === model.id ? 'bg-primary/15 text-primary font-medium' : 'text-card-foreground'}`}
                  >
                    <div className="font-medium">{model.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{model.id.substring('openrouter/'.length)}</div>
                  </button>
                ))}
              </>
            )}
            {!loading && openRouterModels.length === 0 && !search && (
              <div className="px-3 py-2 text-xs text-muted-foreground italic">
                Add an OPENROUTER_API_KEY to env.js to access hundreds of additional models.
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground">No models match your search.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
