

import React, { useState } from 'react';
import { LanguageSpecificRubricScores, HarmDisparityMetrics, RubricDimension, VerifiableEntity, CustomCriterionScore } from '../types';
import { 
    HARM_SCALE,
    NON_DISCRIMINATION_OPTIONS,
    SAFETY_DIGNITY_OPTIONS,
    FREEDOM_EXPRESSION_OPTIONS,
    YES_NO_UNSURE_OPTIONS,
    RUBRIC_DIMENSIONS,
    DISPARITY_CRITERIA
} from '../constants';
import Tooltip from './Tooltip';

const getHarmBadgeClass = (value: number) => {
  if (value >= 4) return 'bg-green-100 text-green-800 border-green-300';
  if (value === 3) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (value === 2) return 'bg-orange-100 text-orange-800 border-orange-300';
  return 'bg-red-100 text-red-800 border-red-300';
};

const getCategoricalBadgeClass = (value: string) => {
  switch (value) {
    case 'no_harm_detected':
    case 'safe_and_dignified':
    case 'respectful_of_freedoms':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'subtle_or_potential_harm':
    case 'potential_risk_undignified':
    case 'potential_infringement':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'clear_and_present_danger':
    case 'overt_or_severe_harm':
    case 'clear_violation':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const EditableEntityList: React.FC<{
  entities: VerifiableEntity[];
  onEntitiesChange: (newEntities: VerifiableEntity[]) => void;
  entityType: VerifiableEntity['type'];
  title: string;
  isManualEntry?: boolean;
}> = ({ entities, onEntitiesChange, entityType, title, isManualEntry = false }) => {
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  const filteredEntities = entities.filter(e => e.type === entityType);

  const handleStatusUpdate = (id: string, newStatus: VerifiableEntity['status']) => {
    onEntitiesChange(entities.map(e => e.id === id ? { ...e, status: newStatus } : e));
  };

  const handleDelete = (id: string) => {
    onEntitiesChange(entities.filter(e => e.id !== id));
  };

  const handleAddStart = () => {
    setIsAdding(true);
    setNewValue('');
  };

  const handleAddCancel = () => {
    setIsAdding(false);
    setNewValue('');
  };
  
  const handleAddSave = () => {
    if (newValue.trim()) {
        const newEntity: VerifiableEntity = {
            id: `${entityType}-${Date.now()}`,
            value: newValue.trim(),
            type: entityType,
            status: 'unchecked'
        };
        onEntitiesChange([...entities, newEntity]);
        handleAddCancel();
    }
  };

  const handleEditStart = (entity: VerifiableEntity) => {
    setEditingEntityId(entity.id);
    setEditingValue(entity.value);
  };

  const handleEditSave = (id: string) => {
    onEntitiesChange(entities.map(e => e.id === id ? { ...e, value: editingValue } : e));
    setEditingEntityId(null);
    setEditingValue('');
  };

  const handleEditCancel = () => {
    setEditingEntityId(null);
    setEditingValue('');
  };

  const parseLinkEntity = (value: string): { text: string; href: string } => {
    // Catches [text](url) or [url](url)
    let match = value.match(/\[(.*?)\]\((.*?)\)/);
    if (match && match[1] !== undefined && match[2]) {
        return { text: match[1] || match[2], href: match[2] };
    }
    // Catches malformed text](url)
    match = value.match(/(.*?)\]\((.*?)\)/);
    if (match && match[1] && match[2]) {
        return { text: match[1], href: match[2] };
    }
    // Default case: the whole value is the link
    return { text: value, href: value };
  };

  const getEntityHref = (entity: VerifiableEntity): string => {
    switch(entity.type) {
      case 'link':
        const { href } = parseLinkEntity(entity.value);
        return href.startsWith('http') ? href : `//${href}`;
      case 'email':
        return `mailto:${entity.value}`;
      case 'phone':
        return `https://www.google.com/search?q=${encodeURIComponent(entity.value)}`;
      case 'address':
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entity.value)}`;
      case 'reference':
        return `https://www.google.com/search?q=${encodeURIComponent(entity.value)}`;
      default:
        return '#';
    }
  }
  
  const getEntityDisplayValue = (entity: VerifiableEntity): string => {
    if (entity.type === 'link') {
      return parseLinkEntity(entity.value).text;
    }
    return entity.value;
  };

  return (
    <div className="bg-background p-3 rounded-lg border border-border/60">
        <div className="flex justify-between items-center mb-2">
            <h5 className="text-sm font-semibold text-foreground">{title} ({filteredEntities.length})</h5>
            <button type="button" onClick={handleAddStart} className="text-xs bg-secondary hover:bg-muted text-secondary-foreground px-2 py-1 rounded-md transition-colors" aria-label={`Add new ${title}`}>+ Add</button>
        </div>
        {filteredEntities.length === 0 && !isAdding && (
            <p className="text-xs text-muted-foreground italic text-center py-2">{isManualEntry ? 'None added yet.' : 'None detected.'} Add manually if needed.</p>
        )}
        <ul className="space-y-2 text-xs max-h-48 overflow-y-auto custom-scrollbar pr-2">
            {isAdding && (
                <li className="p-2 bg-accent/10 rounded-md border border-accent/30 flex items-center gap-2">
                    <input 
                        type="text" 
                        value={newValue} 
                        onChange={e => setNewValue(e.target.value)} 
                        className="form-input w-full text-xs p-1 rounded bg-card border-accent" 
                        placeholder={`Enter new ${title}...`}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleAddSave()}
                    />
                    <button type="button" onClick={handleAddSave} className="p-1 rounded bg-green-500 text-white hover:bg-green-600">✓</button>
                    <button type="button" onClick={handleAddCancel} className="p-1 rounded bg-red-500 text-white hover:bg-red-600">✗</button>
                </li>
            )}
            {filteredEntities.map(entity => (
                <li key={entity.id} className="p-2 bg-background rounded-md border border-border/80 flex items-center gap-2 flex-wrap">
                    {editingEntityId === entity.id ? (
                      <div className="flex-grow flex items-center gap-2">
                        <input type="text" value={editingValue} onChange={e => setEditingValue(e.target.value)} className="form-input w-full text-xs p-1 rounded bg-card border-accent" />
                        <button type="button" onClick={() => handleEditSave(entity.id)} className="p-1 rounded bg-green-500 text-white hover:bg-green-600">✓</button>
                        <button type="button" onClick={handleEditCancel} className="p-1 rounded bg-red-500 text-white hover:bg-red-600">✗</button>
                      </div>
                    ) : (
                      <>
                        <a href={getEntityHref(entity)} target="_blank" rel="noopener noreferrer" className="flex-grow font-mono truncate text-primary hover:underline" title={`Verify: ${entity.value}`}>{getEntityDisplayValue(entity)}</a>
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                            <button type="button" onClick={() => handleStatusUpdate(entity.id, 'working')} className={`px-1.5 py-0.5 rounded ${entity.status === 'working' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-800 hover:bg-green-200'}`} aria-label="Mark as working">✓</button>
                            <button type="button" onClick={() => handleStatusUpdate(entity.id, 'not_working')} className={`px-1.5 py-0.5 rounded ${entity.status === 'not_working' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-800 hover:bg-red-200'}`} aria-label="Mark as not working">✗</button>
                            <button type="button" onClick={() => handleEditStart(entity)} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="Edit">✎</button>
                            <button type="button" onClick={() => handleDelete(entity.id)} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground" aria-label="Delete">🗑</button>
                        </div>
                      </>
                    )}
                </li>
            ))}
        </ul>
    </div>
  );
};


interface EvaluationFormProps {
  nativeScores: LanguageSpecificRubricScores;
  onNativeScoresChange: (scores: LanguageSpecificRubricScores) => void;
  englishScores: LanguageSpecificRubricScores;
  onEnglishScoresChange: (scores: LanguageSpecificRubricScores) => void;
  harmDisparityMetrics: HarmDisparityMetrics;
  onHarmDisparityMetricsChange: (metrics: HarmDisparityMetrics) => void;
  overallNotes: string;
  onOverallNotesChange: (notes: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  
  // New props for dynamic titles
  titleA?: string;
  titleB?: string;

  isManuallyFlaggedForReview: boolean;
  onIsManuallyFlaggedForReviewChange: (isFlagged: boolean) => void;
  isEnglishResponseError?: boolean;
  isNativeResponseError?: boolean;
  generationTimeEnglish?: number | null;
  generationTimeNative?: number | null;
  wordCountEnglish?: number;
  wordCountNative?: number;
  wordsPerSecondEnglish?: number | null;
  wordsPerSecondNative?: number | null;
  isEditing?: boolean;
}

const HarmAssessmentSection: React.FC<{
  scores: LanguageSpecificRubricScores;
  onScoreChange: (key: keyof LanguageSpecificRubricScores, value: any) => void;
  onCustomCriterionValueChange: (id: string, value: number | string) => void;
  sectionIdPrefix: string;
}> = ({ scores, onScoreChange, onCustomCriterionValueChange, sectionIdPrefix }) => (
  <div className="space-y-8">
    {RUBRIC_DIMENSIONS.map(dim => {
      const inputId = `${sectionIdPrefix}-${dim.key}`;
      return (
        <div key={inputId} className="py-4 border-b border-border/70 last:border-b-0 last:pb-0">
          <fieldset>
            <div className="flex justify-between items-start mb-2.5">
              <div className="flex items-center gap-2">
                 <legend id={`${inputId}-label`} className="block text-md font-medium text-card-foreground">{dim.label}</legend>
                 <Tooltip content={
                    <div>
                        <h4 className="font-bold mb-1 border-b border-border">Relevant Human Rights</h4>
                        <ul className="list-disc list-inside space-y-1">
                            {dim.humanRightsMapping.map(hr => <li key={hr.name}><strong>{hr.name}:</strong> {hr.description}</li>)}
                        </ul>
                    </div>
                 }>
                    <span className="text-muted-foreground cursor-help border border-dashed border-muted-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs">?</span>
                 </Tooltip>
              </div>
              {dim.isSlider && (
                <span className={`text-sm font-semibold px-3 py-1 border rounded-full min-w-[3rem] text-center ${getHarmBadgeClass(scores[dim.key] as number)}`}>
                  {scores[dim.key as 'actionability_practicality' | 'factuality' | 'tone_dignity_empathy']}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{dim.description}</p>
            
            {dim.isSlider && dim.scale && (
              <>
                <input id={inputId} type="range" min={dim.scale[0].value} max={dim.scale[dim.scale.length - 1].value} step="1" value={scores[dim.key] as number} onChange={(e) => onScoreChange(dim.key, parseInt(e.target.value))} className="form-range w-full form-range-thumb-focus" aria-labelledby={`${inputId}-label`}/>
                <p className="text-sm text-muted-foreground mt-3 text-center">Current: <span className="font-semibold text-card-foreground">{dim.scale.find(s => s.value === (scores[dim.key] as number))?.label}</span></p>
              </>
            )}

            {dim.isCategorical && dim.options && dim.detailsKey && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3.5">
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {dim.options.map(option => (
                        <label key={option.value} className="flex items-center space-x-2.5 cursor-pointer group">
                            <input type="radio" name={inputId} value={option.value} checked={scores[dim.key] === option.value} onChange={(e) => onScoreChange(dim.key, e.target.value)} className="form-radio h-4 w-4 text-primary focus:ring-ring border-input accent-primary"/>
                            <span className="text-sm text-foreground group-hover:text-primary">{option.label}</span>
                        </label>
                        ))}
                    </div>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getCategoricalBadgeClass(scores[dim.key] as string)}`}>
                        {dim.options.find(opt => opt.value === scores[dim.key])?.label}
                    </span>
                </div>
                {scores[dim.key] !== 'no_harm_detected' && scores[dim.key] !== 'safe_and_dignified' && scores[dim.key] !== 'respectful_of_freedoms' && (
                  <div>
                    <label htmlFor={`${inputId}-details`} className="block text-sm font-medium text-foreground mb-1.5">Details:</label>
                    <textarea id={`${inputId}-details`} rows={3} value={scores[dim.detailsKey] as string} onChange={(e) => onScoreChange(dim.detailsKey, e.target.value)} placeholder="Please provide specific details, examples, or quotes..." className="form-textarea w-full p-3 border rounded-md shadow-sm bg-background border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm text-foreground placeholder:text-muted-foreground"/>
                  </div>
                )}
              </>
            )}
            
            {dim.hasEntityVerification && (
                <div className="mt-6 p-4 rounded-lg bg-background/50 dark:bg-card/20 border border-border/80 shadow-inner relative">
                    <div className="flex items-center gap-2 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-primary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div className='flex-grow'>
                             <h4 className="text-md font-semibold text-foreground" style={{fontFamily: "'Inter', sans-serif"}}>Fact-Checking Toolkit</h4>
                             <p className="text-xs text-muted-foreground">Verify detected entities and add manual ones. Your findings inform the 'Factuality' score.</p>
                        </div>
                    </div>
                     <div className="space-y-3">
                        <EditableEntityList entities={scores.entities} onEntitiesChange={(newEntities) => onScoreChange('entities', newEntities)} entityType="link" title="Links"/>
                        <EditableEntityList entities={scores.entities} onEntitiesChange={(newEntities) => onScoreChange('entities', newEntities)} entityType="email" title="Emails"/>
                        <EditableEntityList entities={scores.entities} onEntitiesChange={(newEntities) => onScoreChange('entities', newEntities)} entityType="phone" title="Phone Numbers"/>
                        <EditableEntityList entities={scores.entities} onEntitiesChange={(newEntities) => onScoreChange('entities', newEntities)} entityType="address" title="Physical Addresses"/>
                        <EditableEntityList entities={scores.entities} onEntitiesChange={(newEntities) => onScoreChange('entities', newEntities)} entityType="reference" title="Laws, Organizations, & Individuals" />
                    </div>
                </div>
            )}
          </fieldset>
        </div>
      );
    })}

    {scores.custom_criteria.map(criterion => {
      const inputId = `${sectionIdPrefix}-custom-${criterion.id}`;
      return (
        <div key={inputId} className="py-4 border-b border-border/70 last:border-b-0 last:pb-0">
          <fieldset>
            <div className="flex justify-between items-start mb-2.5">
              <legend id={`${inputId}-label`} className="block text-md font-medium text-card-foreground">
                {criterion.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Custom</span>
              </legend>
              {criterion.type === 'slider' && (
                <span className={`text-sm font-semibold px-3 py-1 border rounded-full min-w-[3rem] text-center ${getHarmBadgeClass(criterion.value as number)}`}>
                  {criterion.value}
                </span>
              )}
            </div>
            {criterion.description && (
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{criterion.description}</p>
            )}
            {criterion.type === 'slider' && (
              <>
                <input
                  id={inputId}
                  type="range" min={1} max={5} step="1"
                  value={criterion.value as number}
                  onChange={(e) => onCustomCriterionValueChange(criterion.id, parseInt(e.target.value))}
                  className="form-range w-full form-range-thumb-focus"
                  aria-labelledby={`${inputId}-label`}
                />
                <p className="text-sm text-muted-foreground mt-3 text-center">
                  Current: <span className="font-semibold text-card-foreground">{criterion.value} / 5</span>
                </p>
              </>
            )}
            {criterion.type === 'custom_options' && criterion.options && (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {criterion.options.map((option, idx) => (
                  <label key={idx} className="flex items-center space-x-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name={inputId}
                      value={option}
                      checked={criterion.value === option}
                      onChange={() => onCustomCriterionValueChange(criterion.id, option)}
                      className="form-radio h-4 w-4 text-primary focus:ring-ring border-input accent-primary"
                    />
                    <span className="text-sm text-foreground group-hover:text-primary">{option}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </div>
      );
    })}
  </div>
);

const EvaluationForm: React.FC<EvaluationFormProps> = ({
  nativeScores, onNativeScoresChange, 
  englishScores, onEnglishScoresChange, 
  harmDisparityMetrics, onHarmDisparityMetricsChange,
  overallNotes, onOverallNotesChange,
  onSubmit, disabled, 
  titleA, titleB,
  isManuallyFlaggedForReview, onIsManuallyFlaggedForReviewChange,
  isEnglishResponseError = false,
  isNativeResponseError = false,
  generationTimeEnglish,
  generationTimeNative,
  wordCountEnglish,
  wordCountNative,
  wordsPerSecondEnglish,
  wordsPerSecondNative,
  isEditing = false,
}) => {

  const handleScoreChange = (setter: Function, currentScores: LanguageSpecificRubricScores) =>
    (key: keyof LanguageSpecificRubricScores, value: string | number | VerifiableEntity[]) => {
      setter({ ...currentScores, [key]: value });
  };

  const handleCustomCriterionValueChange = (setter: Function, currentScores: LanguageSpecificRubricScores) =>
    (id: string, value: number | string) => {
      setter({
        ...currentScores,
        custom_criteria: currentScores.custom_criteria.map(c => c.id === id ? { ...c, value } : c),
      });
    };

  const handleDisparityMetricChange = (key: keyof HarmDisparityMetrics, value: string) => {
    onHarmDisparityMetricsChange({ ...harmDisparityMetrics, [key]: value });
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(); };

  // --- Custom criteria management ---
  const [isAddingCriterion, setIsAddingCriterion] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'slider' | 'custom_options'>('slider');
  const [newOptions, setNewOptions] = useState(['', '']);

  const handleAddCriterion = () => {
    if (!newLabel.trim()) return;
    const id = `custom-${Date.now()}`;
    const validOptions = newOptions.map(o => o.trim()).filter(Boolean);
    const newCriterion: CustomCriterionScore = {
      id,
      label: newLabel.trim(),
      description: newDesc.trim(),
      type: newType,
      value: newType === 'slider' ? 3 : (validOptions[0] ?? ''),
      options: newType === 'custom_options' ? validOptions : undefined,
    };
    onEnglishScoresChange({ ...englishScores, custom_criteria: [...englishScores.custom_criteria, { ...newCriterion }] });
    onNativeScoresChange({ ...nativeScores, custom_criteria: [...nativeScores.custom_criteria, { ...newCriterion }] });
    setIsAddingCriterion(false);
    setNewLabel('');
    setNewDesc('');
    setNewType('slider');
    setNewOptions(['', '']);
  };

  const handleDeleteCriterion = (id: string) => {
    onEnglishScoresChange({ ...englishScores, custom_criteria: englishScores.custom_criteria.filter(c => c.id !== id) });
    onNativeScoresChange({ ...nativeScores, custom_criteria: nativeScores.custom_criteria.filter(c => c.id !== id) });
  };

  const handleOptionChange = (idx: number, val: string) => {
    setNewOptions(prev => prev.map((o, i) => i === idx ? val : o));
  };

  const addOption = () => setNewOptions(prev => [...prev, '']);
  const removeOption = (idx: number) => setNewOptions(prev => prev.filter((_, i) => i !== idx));
  
  // Use dynamic titles, with fallbacks for safety.
  // In the Reasoning Lab, 'english' scores map to Column A, 'native' to Column B.
  const safeTitleA = titleA || 'Response A';
  const safeTitleB = titleB || 'Response B';

  const isComparisonDisabled = isEnglishResponseError || isNativeResponseError;
  
  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      <h2 className="text-xl sm:text-2xl font-bold text-foreground text-center tracking-tight">3. Human Rights-based Assessment</h2>
      
      <div className="bg-background p-4 rounded-lg border border-border/70 shadow-sm">
        <h3 className="sr-only">Performance Metrics</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div>
                <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5" title={safeTitleA}>⏱️ Time (A)</div>
                <div className="text-lg font-bold text-foreground mt-1">{generationTimeEnglish?.toFixed(2) ?? 'N/A'}s</div>
            </div>
            <div>
                <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5" title={safeTitleA}>✍️ Words (A)</div>
                <div className="text-lg font-bold text-foreground mt-1">{wordCountEnglish ?? 'N/A'}</div>
                {wordsPerSecondEnglish != null && (
                    <div className="text-xs text-muted-foreground mt-0.5">({wordsPerSecondEnglish.toFixed(2)} w/s)</div>
                )}
            </div>
            <div>
                <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5" title={safeTitleB}>⏱️ Time (B)</div>
                <div className="text-lg font-bold text-foreground mt-1">{generationTimeNative?.toFixed(2) ?? 'N/A'}s</div>
            </div>
            <div>
                <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1.5" title={safeTitleB}>✍️ Words (B)</div>
                <div className="text-lg font-bold text-foreground mt-1">{wordCountNative ?? 'N/A'}</div>
                {wordsPerSecondNative != null && (
                    <div className="text-xs text-muted-foreground mt-0.5">({wordsPerSecondNative.toFixed(2)} w/s)</div>
                )}
            </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 text-center">A. Single Response Harm Assessment</h3>

        {/* Custom Criteria Management */}
        <div className="mb-6 p-4 rounded-lg border border-dashed border-primary/40 bg-primary/5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Custom Criteria</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Add your own evaluation criteria applied to both responses.</p>
            </div>
            {!isAddingCriterion && (
              <button type="button" onClick={() => setIsAddingCriterion(true)}
                className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary-hover transition-colors">
                + Add Criterion
              </button>
            )}
          </div>

          {/* Existing custom criteria list */}
          {englishScores.custom_criteria.length > 0 && (
            <ul className="space-y-2 mb-3">
              {englishScores.custom_criteria.map(c => (
                <li key={c.id} className="flex items-center justify-between bg-background rounded-md px-3 py-2 border border-border/70 text-sm">
                  <span className="font-medium text-foreground">{c.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{c.type === 'slider' ? '1–5 Scale' : `Options: ${c.options?.join(', ')}`}</span>
                    <button type="button" onClick={() => handleDeleteCriterion(c.id)}
                      className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors">
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Add criterion form */}
          {isAddingCriterion && (
            <div className="mt-2 space-y-3 bg-background p-4 rounded-lg border border-border">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Criterion Name *</label>
                <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  placeholder="e.g. Clarity, Cultural Relevance..."
                  className="form-input w-full text-sm p-2 rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Description (optional)</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                  placeholder="Describe what evaluators should look for..."
                  className="form-textarea w-full text-sm p-2 rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Scoring Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" checked={newType === 'slider'} onChange={() => setNewType('slider')} className="accent-primary" />
                    1–5 Scale
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" checked={newType === 'custom_options'} onChange={() => setNewType('custom_options')} className="accent-primary" />
                    Custom Options
                  </label>
                </div>
              </div>
              {newType === 'custom_options' && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Options (at least 2)</label>
                  <div className="space-y-1.5">
                    {newOptions.map((opt, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input type="text" value={opt} onChange={e => handleOptionChange(idx, e.target.value)}
                          placeholder={`Option ${idx + 1}`}
                          className="form-input flex-grow text-sm p-1.5 rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                        {newOptions.length > 2 && (
                          <button type="button" onClick={() => removeOption(idx)}
                            className="text-xs px-1.5 py-1 rounded bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground">✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addOption}
                      className="text-xs text-primary hover:underline mt-1">+ Add Option</button>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={handleAddCriterion}
                  disabled={!newLabel.trim() || (newType === 'custom_options' && newOptions.filter(o => o.trim()).length < 2)}
                  className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  Add to Both Columns
                </button>
                <button type="button" onClick={() => { setIsAddingCriterion(false); setNewLabel(''); setNewDesc(''); setNewType('slider'); setNewOptions(['', '']); }}
                  className="text-sm bg-muted text-muted-foreground px-4 py-1.5 rounded-md hover:bg-accent transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 mt-6">
          <fieldset disabled={isEnglishResponseError} className="space-y-4 disabled:opacity-60 disabled:cursor-not-allowed">
            {isEnglishResponseError && (
              <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-center font-medium">
                {safeTitleA} response generation failed. Evaluation for this section is disabled.
              </div>
            )}
            <h4 className="text-md font-semibold text-center text-primary pb-2 border-b border-border mb-4">{safeTitleA}</h4>
            <HarmAssessmentSection scores={englishScores} onScoreChange={handleScoreChange(onEnglishScoresChange, englishScores)} onCustomCriterionValueChange={handleCustomCriterionValueChange(onEnglishScoresChange, englishScores)} sectionIdPrefix="english-eval" />
          </fieldset>

          <fieldset disabled={isNativeResponseError} className="space-y-4 disabled:opacity-60 disabled:cursor-not-allowed">
             {isNativeResponseError && (
                <div className="p-3 text-sm bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-center font-medium">
                  {safeTitleB} response generation failed. Evaluation for this section is disabled.
                </div>
              )}
            <h4 className="text-md font-semibold text-center text-primary pb-2 border-b border-border mb-4">{safeTitleB}</h4>
            <HarmAssessmentSection scores={nativeScores} onScoreChange={handleScoreChange(onNativeScoresChange, nativeScores)} onCustomCriterionValueChange={handleCustomCriterionValueChange(onNativeScoresChange, nativeScores)} sectionIdPrefix="native-eval" />
          </fieldset>
        </div>
      </div>

      <fieldset disabled={isComparisonDisabled} className="space-y-8 pt-8 border-t border-border disabled:opacity-60 disabled:cursor-not-allowed">
        <h3 className="text-lg font-semibold text-foreground text-center mb-4">B. Cross-Response Harm Disparity Assessment</h3>
        {isComparisonDisabled && (
            <div className="p-3 text-sm bg-yellow-100/80 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-400/50 dark:border-yellow-600/50 rounded-lg text-center font-medium">
                Comparison is disabled because at least one response failed to generate.
            </div>
        )}
        {DISPARITY_CRITERIA.map(metric => (
            <div key={metric.key} className="py-5">
                <fieldset>
                    <legend className="block text-md font-medium text-foreground mb-2.5">{metric.label}</legend>
                    <p className="text-xs text-muted-foreground mb-3.5 leading-relaxed">{metric.description}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-3.5 mb-3.5">
                        {YES_NO_UNSURE_OPTIONS.map(option => (
                        <label key={option.value} className="flex items-center space-x-2.5 cursor-pointer group">
                            <input type="radio" name={metric.key} value={option.value}
                            checked={harmDisparityMetrics[metric.key as keyof HarmDisparityMetrics] === option.value}
                            onChange={(e) => handleDisparityMetricChange(metric.key as keyof HarmDisparityMetrics, e.target.value)}
                            className="form-radio h-4 w-4 text-primary focus:ring-ring border-input accent-primary"/>
                            <span className="text-sm text-foreground group-hover:text-primary">{option.label}</span>
                        </label>
                        ))}
                    </div>
                    {harmDisparityMetrics[metric.key as keyof HarmDisparityMetrics] === 'yes' && ( 
                        <div>
                            <label htmlFor={metric.detailsKey} className="block text-sm font-medium text-foreground mb-1.5">Details for {metric.label}:</label>
                            <textarea id={metric.detailsKey} rows={3}
                                value={harmDisparityMetrics[metric.detailsKey as keyof HarmDisparityMetrics]}
                                onChange={(e) => handleDisparityMetricChange(metric.detailsKey as keyof HarmDisparityMetrics, e.target.value)}
                                placeholder="Please provide specific examples or observations..."
                                className="form-textarea w-full p-3 border rounded-md shadow-sm bg-background border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    )}
                </fieldset>
            </div>
        ))}
      </fieldset>

      <div className="pt-6">
        <label htmlFor="overall_evaluation_notes" className="block text-lg font-semibold text-foreground mb-3">
          C. Overall Notes & Impact Summary
        </label>
        <textarea id="overall_evaluation_notes" rows={5} value={overallNotes}
          onChange={(e) => onOverallNotesChange(e.target.value)}
          placeholder="Summarize the overall human rights implications. Note any significant positive impacts, risks, or ethical concerns observed across both responses and their comparison..."
          className="form-textarea w-full p-3 border rounded-md shadow-sm bg-background border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className={`p-4 my-6 rounded-lg border-2 transition-colors duration-300 ${isManuallyFlaggedForReview ? 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-600' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600'}`}>
        <div className="flex items-start sm:items-center gap-4">
            <div className={`text-2xl flex-shrink-0 mt-1 sm:mt-0 ${isManuallyFlaggedForReview ? 'text-red-600' : 'text-yellow-600'}`}>
                {isManuallyFlaggedForReview ? '🚩' : '⚠️'}
            </div>
            <div className="flex-grow">
                <label htmlFor="flag_for_admin_toggle" className={`font-bold text-lg cursor-pointer ${isManuallyFlaggedForReview ? 'text-destructive' : 'text-yellow-800 dark:text-yellow-200'}`}>
                    {isManuallyFlaggedForReview ? 'Flagged for Admin Review' : 'Flag for Admin Review'}
                </label>
                <p className={`text-sm mt-1 ${isManuallyFlaggedForReview ? 'text-red-700 dark:text-red-200/90' : 'text-yellow-700 dark:text-yellow-300/90'}`}>
                    Enable this if the evaluation contains severe issues, unexpected model behavior, or other critical concerns that require an administrator's attention. Also, use this flag if you have doubts about your assessment or if the evaluation feels incomplete.
                </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isManuallyFlaggedForReview}
              onClick={() => onIsManuallyFlaggedForReviewChange(!isManuallyFlaggedForReview)}
              id="flag_for_admin_toggle"
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${isManuallyFlaggedForReview ? 'focus:ring-offset-red-50 dark:focus:ring-offset-red-900/20' : 'focus:ring-offset-yellow-50 dark:focus:ring-offset-yellow-900/20'} ${
                isManuallyFlaggedForReview ? 'bg-destructive' : 'bg-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isManuallyFlaggedForReview ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
        </div>
      </div>

      <button type="submit" disabled={disabled}
        className="w-full bg-primary text-primary-foreground font-semibold py-3 px-6 rounded-lg shadow-md hover:bg-primary-hover active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all duration-200 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
        {disabled ? 'Processing...' : isEditing ? 'Update Evaluation' : 'Save Evaluation'}
      </button>
    </form>
  );
};

export default EvaluationForm;
