// components/EvaluationComparison.tsx

import React from 'react';
import { ReasoningEvaluationRecord, RubricDimension, LanguageSpecificRubricScores, VerifiableEntity } from '../types';
import { RUBRIC_DIMENSIONS, YES_NO_UNSURE_OPTIONS, DISPARITY_CRITERIA, getHiddenDisparityKeys } from '../constants';
import { LlmRubricScores, LlmEvaluation } from '../types/llm-judge';

interface EvaluationComparisonProps {
    humanScores: ReasoningEvaluationRecord['humanScores'];
    llmScores: LlmEvaluation;
    humanNotes: string;
    titleA: string;
    titleB: string;
    // Built-in dimensions removed from this specific record's evaluation at save time
    // (ReasoningEvaluationRecord['hiddenBuiltInKeys']) — filtered out of both Section A and
    // Section B here so this report never shows an unscored default as a real judgment.
    hiddenBuiltInKeys: string[];
}

const getRubricDimension = (key: string): RubricDimension | undefined => RUBRIC_DIMENSIONS.find(dim => dim.key === key);
const getCategoricalOptionLabel = (dimensionKey: string, value: string): string => {
    const dim = getRubricDimension(dimensionKey);
    return dim?.options?.find(opt => opt.value === value)?.label || value;
};
const getDisparityLabel = (value: 'yes' | 'no' | 'unsure'): string => YES_NO_UNSURE_OPTIONS.find(opt => opt.value === value)?.label || value;

const ScoreDisplay: React.FC<{
    label: string,
    humanValue: string | number,
    llmValue: string | number,
    isMismatch: boolean,
    details?: string | null,
    detailsLabel?: string,
}> = ({ label, humanValue, llmValue, isMismatch, details, detailsLabel }) => (
    <div className="py-3 border-b border-border/60 last:border-b-0">
        <div className="grid grid-cols-12 gap-4 items-start">
            <div className="col-span-12 sm:col-span-5 font-semibold text-foreground/90">{label}</div>
            <div className={`col-span-6 sm:col-span-3 text-center py-1 rounded ${isMismatch ? 'bg-yellow-100 dark:bg-yellow-900/30 ring-1 ring-inset ring-yellow-500/50' : 'bg-green-50/50 dark:bg-green-900/20'}`}>{humanValue}</div>
            <div className={`col-span-6 sm:col-span-3 text-center py-1 rounded ${isMismatch ? 'bg-yellow-100 dark:bg-yellow-900/30 ring-1 ring-inset ring-yellow-500/50' : 'bg-green-50/50 dark:bg-green-900/20'}`}>{llmValue}</div>
            {details && (
                <div className="col-span-12 mt-1">
                    <p className="text-xs italic text-muted-foreground bg-muted p-2 rounded-md"><strong className="text-foreground/80">{detailsLabel}:</strong> {details}</p>
                </div>
            )}
        </div>
    </div>
);

const EntityListDisplay: React.FC<{ entities: VerifiableEntity[] }> = ({ entities }) => {
    if (entities.length === 0) return <span className="text-muted-foreground/80 italic text-xs">None Detected/Verified</span>;
    const getStatusIcon = (status: VerifiableEntity['status']) => {
        if (status === 'working') return <span className="text-green-500" title="Working">✓</span>;
        if (status === 'not_working') return <span className="text-red-500" title="Not Working">✗</span>;
        return <span className="text-gray-400" title="Unchecked">?</span>;
    };
    return (
        <ul className="list-none space-y-1 ml-1 text-xs max-h-32 overflow-y-auto custom-scrollbar bg-muted/20 p-1.5 rounded-sm">
            {entities.map((item, index) => (
                <li key={index} className="flex items-center gap-2 truncate" title={item.value}>
                    <span className="w-4">{getStatusIcon(item.status)}</span>
                    <a href="#" onClick={(e) => e.preventDefault()} className="truncate text-primary cursor-default">{item.value}</a>
                </li>
            ))}
        </ul>
    );
};

const EvaluationComparison: React.FC<EvaluationComparisonProps> = ({ humanScores, llmScores, humanNotes, titleA, titleB, hiddenBuiltInKeys }) => {
    const hiddenDisparityKeys = getHiddenDisparityKeys(hiddenBuiltInKeys);

    const renderSingleResponseScores = (human: LanguageSpecificRubricScores, llm: LlmRubricScores) => (
        <div className="bg-background p-4 rounded-lg border border-border/70 space-y-2">
            {RUBRIC_DIMENSIONS.filter(dim => !hiddenBuiltInKeys.includes(dim.key)).map(dim => {
                const humanVal = human[dim.key as keyof typeof human];
                const llmVal = llm[dim.key as keyof typeof llm];
                const isMismatch = dim.isSlider ? Math.abs((humanVal as number) - (llmVal as number)) > 1 : humanVal !== llmVal;
                
                const humanDisplay = dim.isSlider 
                    ? `${dim.scale?.find(s => s.value === (humanVal as number))?.label || humanVal} (${humanVal})` 
                    : getCategoricalOptionLabel(dim.key, humanVal as string);
                const llmDisplay = dim.isSlider 
                    ? `${dim.scale?.find(s => s.value === (llmVal as number))?.label || llmVal} (${llmVal})`
                    : getCategoricalOptionLabel(dim.key, llmVal as string);
                
                const humanDetails = dim.detailsKey && human[dim.detailsKey as keyof typeof human];
                const llmDetails = dim.detailsKey && llm[dim.detailsKey as keyof typeof llm];

                return (
                    <React.Fragment key={dim.key}>
                        <ScoreDisplay label={dim.label} humanValue={humanDisplay} llmValue={llmDisplay} isMismatch={isMismatch} />
                        {humanDetails && <div className="text-xs italic text-muted-foreground/80 mt-1 bg-muted p-2 rounded-md"><strong className="text-foreground/80">Human Details:</strong> {humanDetails as string}</div>}
                        {llmDetails && <div className="text-xs italic text-muted-foreground/80 mt-1 bg-muted p-2 rounded-md"><strong className="text-foreground/80">LLM Details:</strong> {llmDetails as string}</div>}
                        {dim.hasEntityVerification && (
                            <div className="py-3 border-b border-border/60 last:border-b-0">
                                <div className="font-semibold text-foreground/90 mb-1">Human-Verified Entities</div>
                                <EntityListDisplay entities={human.entities} />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
            {/* Older records scored before the LLM judge covered custom criteria will have
                no matching entry on the llm side — shown with an honest placeholder rather
                than a fabricated comparison. */}
            {human.custom_criteria.map(criterion => {
                const llmCriterion = llm.custom_criteria?.find(c => c.id === criterion.id);
                const humanDisplay = criterion.type === 'slider' ? `${criterion.value} / 5` : String(criterion.value);
                const llmDisplay = llmCriterion
                    ? (llmCriterion.type === 'slider' ? `${llmCriterion.value} / 5` : String(llmCriterion.value))
                    : 'Not scored by LLM judge';
                const isMismatch = llmCriterion
                    ? (criterion.type === 'slider'
                        ? Math.abs((criterion.value as number) - (llmCriterion.value as number)) > 1
                        : criterion.value !== llmCriterion.value)
                    : false;
                return (
                    <React.Fragment key={criterion.id}>
                        <ScoreDisplay
                            label={`${criterion.label} (Custom)`}
                            humanValue={humanDisplay}
                            llmValue={llmDisplay}
                            isMismatch={isMismatch}
                        />
                        {criterion.details && <div className="text-xs italic text-muted-foreground/80 mt-1 bg-muted p-2 rounded-md"><strong className="text-foreground/80">Human Details:</strong> {criterion.details}</div>}
                        {llmCriterion?.details && <div className="text-xs italic text-muted-foreground/80 mt-1 bg-muted p-2 rounded-md"><strong className="text-foreground/80">LLM Details:</strong> {llmCriterion.details}</div>}
                    </React.Fragment>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-6">
            <h4 className="text-lg font-semibold text-primary mt-6 mb-3 pb-2 border-b border-border/70">Human vs. LLM Evaluation Comparison</h4>
            
            <div className="grid grid-cols-12 gap-4 text-sm font-bold text-center border-b border-border/70 pb-2">
                <div className="col-span-12 sm:col-span-5 text-left">Metric</div>
                <div className="col-span-6 sm:col-span-3">👤 Human</div>
                <div className="col-span-6 sm:col-span-3">🤖 LLM Judge</div>
            </div>

            <div className="space-y-8">
                <div>
                    <h5 className="font-bold text-foreground text-base mb-2">A. Single Response: "{titleA}"</h5>
                    {renderSingleResponseScores(humanScores.english, llmScores.english)}
                </div>
                <div>
                    <h5 className="font-bold text-foreground text-base mb-2">A. Single Response: "{titleB}"</h5>
                    {renderSingleResponseScores(humanScores.native, llmScores.native)}
                </div>
                <div>
                    <h5 className="font-bold text-foreground text-base mb-2">B. Cross-Response Disparity</h5>
                    <div className="bg-background p-4 rounded-lg border border-border/70 space-y-2">
                       {DISPARITY_CRITERIA.filter(crit => !hiddenDisparityKeys.includes(crit.key)).map(crit => {
                           const humanVal = humanScores.disparity[crit.key as keyof typeof humanScores.disparity];
                           const llmVal = llmScores.disparity[crit.key as keyof typeof llmScores.disparity];
                           const isMismatch = humanVal !== llmVal;
                           const humanDetails = humanScores.disparity[crit.detailsKey as keyof typeof humanScores.disparity];
                           const llmDetails = llmScores.disparity[crit.detailsKey as keyof typeof llmScores.disparity];

                           return (
                               <React.Fragment key={crit.key}>
                                   <ScoreDisplay 
                                       label={crit.label}
                                       humanValue={getDisparityLabel(humanVal as any)}
                                       llmValue={getDisparityLabel(llmVal as any)}
                                       isMismatch={isMismatch}
                                   />
                                   {humanDetails && <div className="text-xs italic text-muted-foreground/80 mt-1 bg-muted p-2 rounded-md"><strong className="text-foreground/80">Human Details:</strong> {humanDetails as string}</div>}
                                   {llmDetails && <div className="text-xs italic text-muted-foreground/80 mt-1 bg-muted p-2 rounded-md"><strong className="text-foreground/80">LLM Details:</strong> {llmDetails as string}</div>}
                               </React.Fragment>
                           );
                       })}
                       {(humanScores.disparity.custom_disparities ?? []).map(disparity => {
                           const llmDisparity = llmScores.disparity.custom_disparities?.find(d => d.id === disparity.id);
                           const llmDisplay = llmDisparity ? getDisparityLabel(llmDisparity.value) : 'Not scored by LLM judge';
                           const isMismatch = llmDisparity ? disparity.value !== llmDisparity.value : false;
                           return (
                               <React.Fragment key={disparity.id}>
                                   <ScoreDisplay
                                       label={`Disparity in ${disparity.label} (Custom)`}
                                       humanValue={getDisparityLabel(disparity.value)}
                                       llmValue={llmDisplay}
                                       isMismatch={isMismatch}
                                   />
                                   {disparity.details && <div className="text-xs italic text-muted-foreground/80 mt-1 bg-muted p-2 rounded-md"><strong className="text-foreground/80">Human Details:</strong> {disparity.details}</div>}
                                   {llmDisparity?.details && <div className="text-xs italic text-muted-foreground/80 mt-1 bg-muted p-2 rounded-md"><strong className="text-foreground/80">LLM Details:</strong> {llmDisparity.details}</div>}
                               </React.Fragment>
                           );
                       })}
                    </div>
                </div>
                 <div>
                    <h5 className="font-bold text-foreground text-base mb-2">C. Overall Notes</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-background p-4 rounded-lg border border-border/70">
                            <h6 className="font-semibold mb-2">👤 Human Notes</h6>
                            <p className="italic text-sm leading-relaxed">{humanNotes || "No notes provided."}</p>
                        </div>
                        <div className="bg-background p-4 rounded-lg border border-border/70">
                            <h6 className="font-semibold mb-2">🤖 LLM Judge Notes</h6>
                            <p className="italic text-sm leading-relaxed">{llmScores.notes || "No notes provided."}</p>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default EvaluationComparison;
