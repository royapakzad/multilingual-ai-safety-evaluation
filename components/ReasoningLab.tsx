




import React, { useState, useEffect, useCallback, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { 
    User, ReasoningEvaluationRecord, LLMModelType, 
    LanguageSpecificRubricScores, HarmDisparityMetrics, 
    VerifiableEntity, RubricDimension, CsvScenario, LlmEvaluation
} from '../types';
import { 
    EVALUATIONS_KEY, AVAILABLE_MODELS, REASONING_SYSTEM_INSTRUCTION, 
    INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES, INITIAL_HARM_DISPARITY_METRICS,
    AVAILABLE_NATIVE_LANGUAGES, RUBRIC_DIMENSIONS, HARM_SCALE, YES_NO_UNSURE_OPTIONS, DISPARITY_CRITERIA
} from '../constants';
import * as config from '../env.js';
import LoadingSpinner from './LoadingSpinner';
import ModelSelector from './ModelSelector';
import EvaluationForm from './EvaluationForm';
import ReasoningDashboard from './ReasoningDashboard'; 
import Tooltip from './Tooltip';
import { generateLlmResponse, translateText, evaluateWithLlm } from '../services/llmService';
import { analyzeTextResponse } from '../services/textAnalysisService';
import * as db from '../services/databaseService';
import EvaluationComparison from './EvaluationComparison';

// --- HELPER COMPONENTS ---

const createMarkup = (markdownText: string | undefined | null) => {
    if (!markdownText) return { __html: '<em class="text-muted-foreground opacity-75">No content available.</em>' };
    const rawMarkup = marked(markdownText, { breaks: true, gfm: true });
    return { __html: DOMPurify.sanitize(rawMarkup as string) };
};

const ReasoningResponseCard: React.FC<{ 
  title: string;
  response: string | null;
  reasoning: string | null;
  isLoading: boolean; 
  generationTime?: number | null;
  answerWordCount?: number;
  reasoningWordCount?: number;
}> = ({ title, response, reasoning, isLoading, generationTime, answerWordCount, reasoningWordCount }) => (
    <div className="bg-card text-card-foreground p-6 rounded-xl shadow-md border border-border flex-1 min-h-[300px] flex flex-col">
        <div className="flex justify-between items-start mb-3.5 border-b border-border pb-3">
            <h3 className="text-lg font-semibold text-foreground flex items-center">
                {title}
            </h3>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                {generationTime != null && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Generation Time">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary/70"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" /></svg>
                        <span>{generationTime.toFixed(2)}s</span>
                    </div>
                )}
                 {reasoningWordCount != null && reasoningWordCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Reasoning Word Count">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary/70"><path d="M10.75 4.75a.75.75 0 00-1.5 0v.511c-1.12.373-2.153 1.14-2.83 2.186A3.001 3.001 0 005 10c0 1.657 1.343 3 3 3s3-1.343 3-3a3.001 3.001 0 00-2.42-2.955c-.677-1.046-1.71-1.813-2.83-2.186V4.75zM8 10a2 2 0 104 0 2 2 0 00-4 0z" /></svg>
                        <span>{reasoningWordCount} reasoning words</span>
                    </div>
                )}
                {answerWordCount != null && answerWordCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Answer Word Count">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary/70"><path d="M5.75 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0V2.75z" /><path d="M9.5 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0V2.75z" /><path d="M13.25 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0V2.75z" /><path d="M17 6.5a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 0117 6.5z" /></svg>
                        <span>{answerWordCount} answer words</span>
                    </div>
                )}
            </div>
        </div>
        {isLoading ? (
            <div className="text-muted-foreground text-sm flex-grow flex flex-col items-center justify-center space-y-3">
                <LoadingSpinner size="md" color="text-primary" />
                <span>Generating response...</span>
            </div>
        ) : (
            <div className="flex-grow flex flex-col space-y-4 overflow-y-auto custom-scrollbar pr-2">
                {reasoning && (
                    <details className="border border-blue-200 dark:border-blue-800/60 rounded-lg group bg-blue-50 dark:bg-blue-900/20">
                        <summary className="p-3 cursor-pointer list-none flex items-center text-sm font-medium text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-t-lg select-none">
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2 flex-shrink-0"><path d="M10.75 4.75a.75.75 0 00-1.5 0v.511c-1.12.373-2.153 1.14-2.83 2.186A3.001 3.001 0 005 10c0 1.657 1.343 3 3 3s3-1.343 3-3a3.001 3.001 0 00-2.42-2.955c-.677-1.046-1.71-1.813-2.83-2.186V4.75zM8 10a2 2 0 104 0 2 2 0 00-4 0z" /><path fillRule="evenodd" d="M10 2a.75.75 0 00-1.75.75v.284a5.503 5.503 0 00-3.352 4.466 2.75 2.75 0 00-1.652 2.508 2.75 2.75 0 002.75 2.75 2.75 2.75 0 002.75-2.75 2.75 2.75 0 00-1.652-2.508A5.503 5.503 0 008.25 3.034V2.75A.75.75 0 0010 2zM12.25 10a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" clipRule="evenodd" /></svg>
                            Show/Hide Reasoning
                        </summary>
                         <div 
                            className="p-3 border-t border-blue-200 dark:border-blue-800/60 bg-white dark:bg-card/30 max-h-56 overflow-y-auto custom-scrollbar prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={createMarkup(reasoning)}
                        />
                    </details>
                )}
                 <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">{reasoning ? 'Final Answer:' : 'Response:'}</h4>
                    <div 
                        className="prose dark:prose-invert max-w-none prose-p:my-2 prose-headings:text-foreground prose-strong:text-foreground text-card-foreground text-base leading-relaxed"
                        dangerouslySetInnerHTML={createMarkup(response)}
                    />
                 </div>
            </div>
        )}
    </div>
);


const SetupColumn: React.FC<{
    title: string; onTitleChange: (v: string) => void;
    prompt: string; onPromptChange: (v: string) => void;
    requestReasoning: boolean; onRequestReasoningChange: (v: boolean) => void;
    columnId: 'A' | 'B';
}> = ({ title, onTitleChange, prompt, onPromptChange, requestReasoning, onRequestReasoningChange, columnId }) => (
    <div className="space-y-4 bg-background p-4 rounded-lg border border-border/60">
        <div>
            <label htmlFor={`title_${columnId}`} className="block text-sm font-medium text-foreground mb-1">
                Column {columnId} Title
            </label>
            <input
                id={`title_${columnId}`}
                type="text"
                value={title}
                onChange={e => onTitleChange(e.target.value)}
                className="form-input w-full p-2 border rounded-md shadow-sm bg-card border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                placeholder={`e.g., English w/ Reasoning`}
            />
        </div>
        <div>
            <label htmlFor={`prompt_${columnId}`} className="block text-sm font-medium text-foreground mb-1">
                Prompt
            </label>
            <textarea
                id={`prompt_${columnId}`}
                rows={6}
                value={prompt}
                onChange={e => onPromptChange(e.target.value)}
                className="form-textarea w-full p-2 border rounded-md shadow-sm bg-card border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
                placeholder={`Enter prompt for Column ${columnId} here...`}
            />
        </div>
        <div className="flex items-center space-x-2">
            <input
                id={`reasoning_${columnId}`}
                type="checkbox"
                checked={requestReasoning}
                onChange={e => onRequestReasoningChange(e.target.checked)}
                className="form-checkbox h-4 w-4 rounded text-primary border-border bg-card focus:ring-ring"
            />
            <label htmlFor={`reasoning_${columnId}`} className="block text-sm text-foreground">
                Request explicit reasoning
            </label>
            <Tooltip content={<div className="space-y-2">
                <p>When checked, the following system instruction is sent to the model:</p>
                <pre className="text-xs bg-muted text-muted-foreground p-2 rounded whitespace-pre-wrap font-mono">{REASONING_SYSTEM_INSTRUCTION}</pre>
                </div>
            }>
                <span className="text-muted-foreground cursor-help border border-dashed border-muted-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs">?</span>
            </Tooltip>
        </div>
    </div>
);


// --- MAIN COMPONENT ---

interface ReasoningLabProps {
    currentUser: User;
}

const ReasoningLab: React.FC<ReasoningLabProps> = ({ currentUser }) => {
  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('list');
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState<boolean>(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Input Mode State
  const [inputMode, setInputMode] = useState<'custom' | 'csv'>('custom');
  const [csvScenarios, setCsvScenarios] = useState<CsvScenario[]>([]);
  const [selectedCsvScenarioId, setSelectedCsvScenarioId] = useState<string>('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const [currentScenarioContext, setCurrentScenarioContext] = useState<string>('');

  // Language State
  const [selectedNativeLanguageCode, setSelectedNativeLanguageCode] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  
  // Setup State
  const [selectedModel, setSelectedModel] = useState<LLMModelType>(AVAILABLE_MODELS[0].id);
  const [titleA, setTitleA] = useState('English');
  const [promptA, setPromptA] = useState('');
  const [requestReasoningA, setRequestReasoningA] = useState(false);
  const [titleB, setTitleB] = useState('Native Language');
  const [promptB, setPromptB] = useState('');
  const [requestReasoningB, setRequestReasoningB] = useState(false);

  // API & Response State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  
  const [rawResponseA, setRawResponseA] = useState<string>('');
  const [responseA, setResponseA] = useState<string | null>(null);
  const [reasoningA, setReasoningA] = useState<string | null>(null);
  const [rawResponseB, setRawResponseB] = useState<string>('');
  const [responseB, setResponseB] = useState<string | null>(null);
  const [reasoningB, setReasoningB] = useState<string | null>(null);
  
  const [generationTimeA, setGenerationTimeA] = useState<number | null>(null);
  const [generationTimeB, setGenerationTimeB] = useState<number | null>(null);
  const [answerWordCountA, setAnswerWordCountA] = useState<number>(0);
  const [answerWordCountB, setAnswerWordCountB] = useState<number>(0);
  const [reasoningWordCountA, setReasoningWordCountA] = useState<number>(0);
  const [reasoningWordCountB, setReasoningWordCountB] = useState<number>(0);
  const [wordsPerSecondA, setWordsPerSecondA] = useState<number | null>(null);
  const [wordsPerSecondB, setWordsPerSecondB] = useState<number | null>(null);
  
  // Evaluation State
  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(null);
  const [currentScoresA, setCurrentScoresA] = useState<LanguageSpecificRubricScores>({...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES});
  const [currentScoresB, setCurrentScoresB] = useState<LanguageSpecificRubricScores>({...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES});
  const [currentHarmDisparityMetrics, setCurrentHarmDisparityMetrics] = useState<HarmDisparityMetrics>({...INITIAL_HARM_DISPARITY_METRICS});
  const [evaluationNotes, setEvaluationNotes] = useState<string>('');
  const [allEvaluations, setAllEvaluations] = useState<ReasoningEvaluationRecord[]>([]);
  const [isManuallyFlaggedForReview, setIsManuallyFlaggedForReview] = useState<boolean>(false);
  
  const translationDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial data load
  useEffect(() => {
    const fetchEvaluations = async () => {
      setIsLoadingEvaluations(true);
      const evaluations = await db.getEvaluations(currentUser);
      setAllEvaluations(evaluations.filter(ev => ev.labType === 'reasoning') as ReasoningEvaluationRecord[]);
      setIsLoadingEvaluations(false);
    };
    fetchEvaluations();
  }, [currentUser]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const resetResponsesAndScores = () => {
    setRawResponseA(''); setRawResponseB('');
    setResponseA(null); setResponseB(null);
    setCurrentScoresA({...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES});
    setCurrentScoresB({...INITIAL_LANGUAGE_SPECIFIC_RUBRIC_SCORES});
    setCurrentHarmDisparityMetrics({...INITIAL_HARM_DISPARITY_METRICS});
    setEvaluationNotes('');
    setGenerationTimeA(null); setGenerationTimeB(null);
    setAnswerWordCountA(0); setAnswerWordCountB(0);
    setReasoningWordCountA(0); setReasoningWordCountB(0);
    setWordsPerSecondA(null);
    setWordsPerSecondB(null);
    setIsManuallyFlaggedForReview(false);
    setReasoningA(null); setReasoningB(null);
  };
  
  const resetForNewRun = () => {
      setEditingEvaluationId(null);
      resetResponsesAndScores();
  };
  
  const handleNativeLanguageSelect = (languageCode: string) => {
    setSelectedNativeLanguageCode(languageCode);
    setTranslationError(null);
    setTitleB(AVAILABLE_NATIVE_LANGUAGES.find(l => l.code === languageCode)?.name || 'Native Language');
  };

  // Auto-translation effect
  useEffect(() => {
    if (!promptA.trim()) {
        setPromptB(''); // Clear native prompt if English prompt is empty
    }
    if (!promptA.trim() || !selectedNativeLanguageCode) {
      if (translationDebounceTimer.current) clearTimeout(translationDebounceTimer.current);
      return;
    }

    if (translationDebounceTimer.current) {
      clearTimeout(translationDebounceTimer.current);
    }
    translationDebounceTimer.current = setTimeout(async () => {
        setIsTranslating(true);
        setTranslationError(null);
        try {
          const translated = await translateText(promptA, 'en', selectedNativeLanguageCode);
          setPromptB(translated);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown translation error";
          setTranslationError(`Translation failed: ${msg}. Please enter manually.`);
          setPromptB('');
        } finally {
          setIsTranslating(false);
        }
    }, 750);

     return () => {
        if (translationDebounceTimer.current) clearTimeout(translationDebounceTimer.current);
     }
  }, [promptA, selectedNativeLanguageCode]);


  const parseReasoningAndAnswer = (responseText: string): { reasoning: string | null, answer: string } => {
    if (!responseText) return { reasoning: null, answer: '' };
    const reasoningRegex = /#+\s*Reasoning\s*#*\n?([\s\S]*?)(?=#+\s*Answer|$)/i;
    const answerRegex = /#+\s*Answer\s*#*\n?([\s\S]*)/i;
    const reasoningMatch = responseText.match(reasoningRegex);
    const answerMatch = responseText.match(answerRegex);
    if (!reasoningMatch) { // If reasoning not explicitly found, treat whole text as answer
      return { reasoning: null, answer: responseText };
    }
    const reasoning = reasoningMatch[1].trim();
    const answer = answerMatch ? answerMatch[1].trim() : responseText.replace(reasoningMatch[0], '').trim();
    return { reasoning, answer };
  };
  
  const countWords = (text: string | null) => text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  
  const convertToVerifiable = (text: string, langCode: string = 'en'): VerifiableEntity[] => {
      if (!text) return [];
      const { 
          mentioned_links_list, 
          mentioned_emails_list, 
          mentioned_phones_list, 
          physical_addresses_list,
          mentioned_references_list
      } = analyzeTextResponse(text, langCode);

      const entities: VerifiableEntity[] = [];
      mentioned_links_list.forEach(value => entities.push({ id: `link-${Math.random()}`, value, type: 'link', status: 'unchecked'}));
      mentioned_emails_list.forEach(value => entities.push({ id: `email-${Math.random()}`, value, type: 'email', status: 'unchecked'}));
      mentioned_phones_list.forEach(value => entities.push({ id: `phone-${Math.random()}`, value, type: 'phone', status: 'unchecked'}));
      physical_addresses_list.forEach(value => entities.push({ id: `address-${Math.random()}`, value, type: 'address', status: 'unchecked'}));
      mentioned_references_list.forEach(value => entities.push({ id: `reference-${Math.random()}`, value, type: 'reference', status: 'unchecked'}));
      
      return entities;
  };

  const handleRunExperiment = async () => {
    if (!promptA.trim() || !promptB.trim()) {
      setError("Please fill in both prompts before running the experiment.");
      return;
    }
    setIsLoading(true); setError(null); resetForNewRun();
    
    const langInfo = AVAILABLE_NATIVE_LANGUAGES.find(l => l.code === selectedNativeLanguageCode);
    const nativeLanguageName = langInfo ? langInfo.name : 'the selected native language';

    const configA = requestReasoningA ? { systemInstruction: REASONING_SYSTEM_INSTRUCTION } : {};
    let configB = {};
    if (requestReasoningB) {
        const reasoningInstructionB = `First, in a section titled "## Reasoning", provide your step-by-step thinking process in ${nativeLanguageName}. Then, in a separate section titled "## Answer", provide the final, user-facing response. Your entire output must contain both sections.`;
        configB = { systemInstruction: reasoningInstructionB };
    }
    
    try {
        const startTimeA = performance.now();
        const resA = await generateLlmResponse(promptA, selectedModel, configA);
        const endTimeA = performance.now();
        const genTimeASeconds = (endTimeA - startTimeA) / 1000;
        setGenerationTimeA(genTimeASeconds);
        
        const startTimeB = performance.now();
        const resB = await generateLlmResponse(promptB, selectedModel, configB);
        const endTimeB = performance.now();
        const genTimeBSeconds = (endTimeB - startTimeB) / 1000;
        setGenerationTimeB(genTimeBSeconds);
        
        setRawResponseA(resA);
        const parsedA = parseReasoningAndAnswer(requestReasoningA ? resA : resA);
        setReasoningA(parsedA.reasoning);
        setResponseA(parsedA.answer);
        const ansWordsA = countWords(parsedA.answer);
        setReasoningWordCountA(countWords(parsedA.reasoning));
        setAnswerWordCountA(ansWordsA);
        setCurrentScoresA(prev => ({...prev, entities: convertToVerifiable(parsedA.answer, 'en')}));
        setWordsPerSecondA(genTimeASeconds > 0 ? ansWordsA / genTimeASeconds : 0);

        setRawResponseB(resB);
        const parsedB = parseReasoningAndAnswer(requestReasoningB ? resB : resB);
        setReasoningB(parsedB.reasoning);
        setResponseB(parsedB.answer);
        const ansWordsB = countWords(parsedB.answer);
        setReasoningWordCountB(countWords(parsedB.reasoning));
        setAnswerWordCountB(ansWordsB);
        setCurrentScoresB(prev => ({...prev, entities: convertToVerifiable(parsedB.answer, selectedNativeLanguageCode)}));
        setWordsPerSecondB(genTimeBSeconds > 0 ? ansWordsB / genTimeBSeconds : 0);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false); setCooldown(8);
    }
  };

  const handleStartEdit = (evaluationId: string) => {
    const recordToEdit = allEvaluations.find(ev => ev.id === evaluationId);
    if (!recordToEdit) {
      setError("Could not find the evaluation record to edit.");
      return;
    }

    // Set editing state
    setEditingEvaluationId(recordToEdit.id);

    // Populate all form fields
    setSelectedModel(recordToEdit.model);
    
    const langInfo = AVAILABLE_NATIVE_LANGUAGES.find(l => recordToEdit.languagePair.includes(l.name));
    setSelectedNativeLanguageCode(langInfo?.code || '');
    
    setCurrentScenarioContext(recordToEdit.scenarioContext || '');

    // Setup columns
    setTitleA(recordToEdit.titleA);
    setPromptA(recordToEdit.promptA);
    setRequestReasoningA(recordToEdit.reasoningRequestedA);
    setTitleB(recordToEdit.titleB);
    setPromptB(recordToEdit.promptB);
    setRequestReasoningB(recordToEdit.reasoningRequestedB);

    // LLM Responses (raw and parsed)
    setRawResponseA(recordToEdit.rawResponseA);
    setResponseA(recordToEdit.responseA);
    setReasoningA(recordToEdit.reasoningA);
    setRawResponseB(recordToEdit.rawResponseB);
    setResponseB(recordToEdit.responseB);
    setReasoningB(recordToEdit.reasoningB);

    // Performance metrics
    setGenerationTimeA(recordToEdit.generationTimeSecondsA ?? null);
    setAnswerWordCountA(recordToEdit.answerWordCountA);
    setReasoningWordCountA(recordToEdit.reasoningWordCountA);
    setWordsPerSecondA(recordToEdit.wordsPerSecondA ?? null);
    setGenerationTimeB(recordToEdit.generationTimeSecondsB ?? null);
    setAnswerWordCountB(recordToEdit.answerWordCountB);
    setReasoningWordCountB(recordToEdit.reasoningWordCountB);
    setWordsPerSecondB(recordToEdit.wordsPerSecondB ?? null);
    
    // Evaluation scores and notes
    setCurrentScoresA(recordToEdit.humanScores.english);
    setCurrentScoresB(recordToEdit.humanScores.native);
    setCurrentHarmDisparityMetrics(recordToEdit.humanScores.disparity);
    setEvaluationNotes(recordToEdit.notes);
    setIsManuallyFlaggedForReview(recordToEdit.isFlaggedForReview ?? false);

    // Scroll to the top to show the populated forms
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEvaluationSubmit = async () => {
    if (responseA === null || responseB === null) {
        alert("Responses must be generated before submitting.");
        return;
    }
    const isUpdating = !!editingEvaluationId;
    const existingRecord = isUpdating ? allEvaluations.find(ev => ev.id === editingEvaluationId) : undefined;
    
    const langInfo = AVAILABLE_NATIVE_LANGUAGES.find(l => l.code === selectedNativeLanguageCode);
    const scenarioId = inputMode === 'csv' ? `csv-scenario-${selectedCsvScenarioId}` : 'custom';
    const scenarioCategory = inputMode === 'csv' ? 'CSV Upload' : 'Custom';
    
    const recordData: ReasoningEvaluationRecord = {
        id: isUpdating ? editingEvaluationId! : `${new Date().toISOString()}-reasoning-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(), // Always update timestamp on edit
        userEmail: existingRecord?.userEmail || currentUser.email, // Preserve original evaluator email
        labType: 'reasoning',
        scenarioId, scenarioCategory,
        scenarioContext: currentScenarioContext,
        languagePair: `English - ${langInfo?.name || "N/A"}`,
        model: selectedModel,
        titleA, promptA, reasoningRequestedA: requestReasoningA, rawResponseA, reasoningA, responseA,
        reasoningWordCountA, answerWordCountA, generationTimeSecondsA: generationTimeA, wordsPerSecondA,
        titleB, promptB, reasoningRequestedB: requestReasoningB, rawResponseB, reasoningB, responseB,
        reasoningWordCountB, answerWordCountB, generationTimeSecondsB: generationTimeB, wordsPerSecondB,
        humanScores: {
            english: currentScoresA,
            native: currentScoresB,
            disparity: currentHarmDisparityMetrics,
        },
        notes: evaluationNotes,
        isFlaggedForReview: isManuallyFlaggedForReview,
        llmEvaluationStatus: existingRecord?.llmEvaluationStatus || 'pending',
        llmScores: existingRecord?.llmScores,
        llmEvaluationError: existingRecord?.llmEvaluationError,
    };

    setIsLoading(true);
    try {
        console.log('🚀 About to save evaluation, isUpdating:', isUpdating);
        console.log('🚀 RecordData being saved:', recordData);
        
        let savedRecord;
        if (isUpdating) {
            console.log('🚀 Calling updateEvaluation...');
            savedRecord = await db.updateEvaluation(recordData);
        } else {
            console.log('🚀 Calling addEvaluation...');
            savedRecord = await db.addEvaluation(recordData);
        }
        
        console.log('🚀 Save completed successfully!');
        console.log('🚀 Saved record with ID:', savedRecord.id);

        const updatedEvals = await db.getEvaluations(currentUser);
        setAllEvaluations(updatedEvals.filter(ev => ev.labType === 'reasoning') as ReasoningEvaluationRecord[]);
        
        alert(isUpdating ? "Evaluation updated successfully!" : "Human evaluation saved! Now getting LLM evaluation in the background...");

        resetForNewRun();
        setPromptA(''); setPromptB(''); setCurrentScenarioContext(''); setSelectedCsvScenarioId('');
        
        if (!isUpdating) {
            (async () => {
                let finalRecord = { ...savedRecord }; // Use the actual saved record with correct ID
                try {
                    const llmScores = await evaluateWithLlm(savedRecord); // Use savedRecord, not recordData
                    finalRecord = { ...finalRecord, llmScores, llmEvaluationStatus: 'completed', llmEvaluationError: null };
                } catch (err) {
                    console.error("LLM Evaluation Failed:", err);
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    finalRecord = { ...finalRecord, llmEvaluationStatus: 'failed', llmEvaluationError: errorMsg };
                }
                
                try {
                    console.log('🚀 Updating LLM results for document ID:', finalRecord.id);
                    await db.updateEvaluation(finalRecord);
                    const finalEvals = await db.getEvaluations(currentUser);
                    setAllEvaluations(finalEvals.filter(ev => ev.labType === 'reasoning') as ReasoningEvaluationRecord[]);
                } catch (updateErr) {
                    console.error("Failed to save LLM evaluation result:", updateErr);
                }
            })();
        }

    } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Could not save evaluation.");
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleToggleFlagForReview = async (evaluationId: string) => {
    const targetEval = allEvaluations.find(ev => ev.id === evaluationId);
    if (!targetEval) return;

    const updatedRecord = { ...targetEval, isFlaggedForReview: !targetEval.isFlaggedForReview };
    
    try {
        await db.updateEvaluation(updatedRecord);
        setAllEvaluations(allEvaluations.map(ev => ev.id === evaluationId ? updatedRecord : ev));
    } catch (e) {
        setError("Failed to update flag status. Please try again.");
        console.error("Failed to update flag status in DB:", e);
    }
  };
  
  const handleDeleteEvaluation = async (evaluationId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this evaluation? This action cannot be undone.")) {
      return;
    }
    try {
      await db.deleteEvaluation(evaluationId);
      setAllEvaluations(allEvaluations.filter(ev => ev.id !== evaluationId));
      alert("Evaluation deleted successfully.");
    } catch (e) {
      setError("Error: Could not delete the evaluation.");
      console.error("Failed to delete evaluation from DB:", e);
    }
  };

  const isRunExperimentDisabled = () => {
    if (isLoading || cooldown > 0 || isTranslating) return true;
    const c = config as any;
    if (selectedModel.startsWith('openrouter/')) {
      if (!c.OPENROUTER_API_KEY || c.OPENROUTER_API_KEY === "YOUR_OPENROUTER_API_KEY_HERE" || c.OPENROUTER_API_KEY === "") return true;
    } else {
      const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);
      if (modelInfo) {
        if (modelInfo.provider === 'gemini' && (!config.API_KEY || (config.API_KEY as string) === "YOUR_GOOGLE_GEMINI_API_KEY_HERE")) return true;
        if (modelInfo.provider === 'openai' && (!config.OPENAI_API_KEY || (config.OPENAI_API_KEY as string) === "YOUR_OPENAI_API_KEY_HERE")) return true;
        if (modelInfo.provider === 'mistral' && (!c.MISTRAL_API_KEY || c.MISTRAL_API_KEY === "YOUR_MISTRAL_API_KEY_HERE")) return true;
      }
    }
    return !promptA.trim() || !promptB.trim();
  };

  const getButtonText = () => {
    if (isTranslating) return <><LoadingSpinner size="sm" color="text-primary-foreground" className="mr-2.5"/>Translating...</>;
    if (isLoading) return <><LoadingSpinner size="sm" color="text-primary-foreground" className="mr-2.5"/>Processing...</>;
    if (cooldown > 0) return `Please wait ${cooldown}s...`;
    return 'Run Experiment';
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setCsvError(null);
      setCsvScenarios([]);
      setSelectedCsvScenarioId('');
      setPromptA('');
      setPromptB('');
      setCurrentScenarioContext('');
      resetForNewRun();

      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target?.result as string;
          if (!text) {
              setCsvError("Cannot read file. It appears to be empty.");
              return;
          }
          const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
          if (lines.length < 2) {
              setCsvError("CSV file must have a header row and at least one data row.");
              return;
          }

          const headerLine = lines[0].trim().split(',');
          const header = headerLine.map(h => h.trim().toLowerCase().replace(/"/g, ''));
          const promptIndex = header.indexOf('prompt');
          const contextIndex = header.indexOf('context');

          if (promptIndex === -1 || contextIndex === -1) {
              setCsvError("CSV header must contain both 'context' and 'prompt' columns.");
              return;
          }

          const scenarios: CsvScenario[] = lines.slice(1).map((line, index) => {
              const columns = line.split(',');
              return {
                  id: index + 1,
                  context: columns[contextIndex]?.trim().replace(/^"|"$/g, '') || '',
                  prompt: columns[promptIndex]?.trim().replace(/^"|"$/g, '') || ''
              };
          });

          setCsvScenarios(scenarios);
      };
      reader.onerror = () => {
          setCsvError("An error occurred while reading the file.");
      };
      reader.readAsText(file);
  };

  useEffect(() => {
    if (inputMode === 'csv' && selectedCsvScenarioId) {
        const scenario = csvScenarios.find(s => s.id === parseInt(selectedCsvScenarioId, 10));
        if (scenario) {
            setPromptA(scenario.prompt);
            setCurrentScenarioContext(scenario.context);
            resetForNewRun();
        }
    }
  }, [selectedCsvScenarioId, csvScenarios, inputMode]);
  
  const downloadCSV = () => {
    if (visibleEvaluations.length === 0) return alert("No data to export.");

    const dataToExport = visibleEvaluations;
    const flattenObject = (obj: any, prefix = ''): any => {
        if (!obj) return { [prefix]: '' };
        return Object.keys(obj).reduce((acc, k) => {
            const pre = prefix ? `${prefix}_` : '';
            if (k === 'entities') { 
                const entities = obj[k] as VerifiableEntity[];
                acc[`${pre}entities_working`] = entities.filter(e => e.status === 'working').map(e => e.value).join('; ');
                acc[`${pre}entities_not_working`] = entities.filter(e => e.status === 'not_working').map(e => e.value).join('; ');
                acc[`${pre}entities_unchecked`] = entities.filter(e => e.status === 'unchecked').map(e => e.value).join('; ');
            } else if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
                Object.assign(acc, flattenObject(obj[k], pre + k));
            } else {
                 acc[pre + k] = Array.isArray(obj[k]) ? obj[k].join('; ') : obj[k];
            }
            return acc;
        }, {} as Record<string, any>);
    }
    
    const flattenedData = dataToExport.map(row => {
        const { humanScores, llmScores, ...rest } = row;
        const flatHumanScores = humanScores ? { ...flattenObject(humanScores.english, 'humanScores_A'), ...flattenObject(humanScores.native, 'humanScores_B'), ...flattenObject(humanScores.disparity, 'humanScores_disparity') } : {};
        const flatLlmScores = llmScores ? { ...flattenObject(llmScores.english, 'llmScores_A'), ...flattenObject(llmScores.native, 'llmScores_B'), ...flattenObject(llmScores.disparity, 'llmScores_disparity') } : {};

        return { ...rest, ...flatHumanScores, ...flatLlmScores };
    });

    const allHeaders = new Set<string>(['id', 'timestamp', 'userEmail', 'labType', 'scenarioId', 'scenarioCategory', 'scenarioContext', 'languagePair', 'model', 'titleA', 'promptA', 'reasoningRequestedA', 'reasoningWordCountA', 'answerWordCountA', 'generationTimeSecondsA', 'wordsPerSecondA', 'titleB', 'promptB', 'reasoningRequestedB', 'reasoningWordCountB', 'answerWordCountB', 'generationTimeSecondsB', 'wordsPerSecondB', 'notes', 'isFlaggedForReview', 'rawResponseA', 'reasoningA', 'responseA', 'rawResponseB', 'reasoningB', 'responseB', 'llmEvaluationStatus', 'llmEvaluationError']);
    flattenedData.forEach(row => Object.keys(row).forEach(header => allHeaders.add(header)));
    const headers = Array.from(allHeaders);
    
    const csvContent = headers.join(",") + "\n" + flattenedData.map(row => headers.map(header => `"${String((row as any)[header] ?? '').replace(/"/g, '""')}"`).join(",")).join("\n");

    // Use Blob API to avoid URL length limitations in Chrome/Firefox
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");

    if ((navigator as any).msSaveBlob) {
      // IE 10+
      (navigator as any).msSaveBlob(blob, `llm_multilingual_comparison_evaluations_${new Date().toISOString().split('T')[0]}.csv`);
    } else {
      // Modern browsers
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `llm_multilingual_comparison_evaluations_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Clean up the URL object
    }
  };
  
  const visibleEvaluations = allEvaluations.filter(evaluation => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return evaluation.promptA.toLowerCase().includes(query) ||
           evaluation.promptB.toLowerCase().includes(query) ||
           evaluation.scenarioContext?.toLowerCase().includes(query) ||
           evaluation.titleA.toLowerCase().includes(query) ||
           evaluation.titleB.toLowerCase().includes(query);
  });
  
  return (
    <div className="space-y-16">
        {error && <div role="alert" className="mb-6 p-4 bg-destructive text-destructive-foreground rounded-lg shadow-lg">{error}</div>}
        
        <section className="bg-card text-card-foreground p-6 sm:p-8 rounded-xl shadow-md border border-border">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-6 pb-4 border-b border-border">1. Experiment Setup</h2>
          <div className="space-y-6">
            <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
             <div className="space-y-4 pt-4 border-t border-border">
                 <div className="flex items-center space-x-4">
                    <h3 className="text-md font-semibold text-foreground">Scenario Input Method</h3>
                    <div className="flex items-center space-x-2 bg-muted p-1 rounded-lg">
                        {(['custom', 'csv'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => { setInputMode(mode); setPromptA(''); setPromptB(''); setSelectedCsvScenarioId(''); setCurrentScenarioContext(''); }}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${inputMode === mode ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-background/50'}`}
                            >
                                {mode === 'custom' ? 'Custom Scenario' : 'Upload CSV'}
                            </button>
                        ))}
                    </div>
                </div>

                {inputMode === 'custom' ? (
                     <div>
                        <label htmlFor="custom_scenario_prompt" className="block text-sm font-medium text-foreground mb-1">Enter Custom Scenario Prompt (English)</label>
                        <textarea id="custom_scenario_prompt" rows={4} value={promptA} onChange={e => { setPromptA(e.target.value); resetForNewRun(); }}
                            className="form-textarea w-full p-2 border rounded-md shadow-sm bg-card border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
                            placeholder="e.g., “My Greek asylum card will expire in 20 days... Is there another way?”" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="csv-upload" className="block text-sm font-medium text-foreground mb-1">Upload Scenarios CSV</label>
                            <p className="text-xs text-muted-foreground mb-2">The CSV file must contain a header row with columns named "context" and "prompt".</p>
                            <input type="file" id="csv-upload" accept=".csv" onChange={handleFileChange}
                                className="form-input w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                            {csvError && <p className="text-xs text-destructive mt-1">{csvError}</p>}
                        </div>
                        {csvScenarios.length > 0 && (
                            <div>
                                <label htmlFor="scenario-select" className="block text-sm font-medium text-foreground mb-1">Select Scenario ({csvScenarios.length} loaded)</label>
                                <select id="scenario-select" value={selectedCsvScenarioId} onChange={e => setSelectedCsvScenarioId(e.target.value)} className="form-select w-full p-2 border rounded-md shadow-sm bg-card border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                                    <option value="">-- Choose a scenario --</option>
                                    {csvScenarios.map(s => <option key={s.id} value={s.id}>Scenario {s.id}: {s.prompt.substring(0, 70)}...</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                )}
                
                <div>
                    <label htmlFor="native_lang_select" className="block text-sm font-medium text-foreground">Translate English Prompt to:</label>
                    <select id="native_lang_select" value={selectedNativeLanguageCode} onChange={(e) => handleNativeLanguageSelect(e.target.value)} className="form-select w-full p-2 border rounded-md shadow-sm bg-card border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm">
                        <option value="">-- Choose target language --</option>
                        {AVAILABLE_NATIVE_LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name} ({lang.code})</option>)}
                    </select>
                    {isTranslating && <div className='text-sm text-primary flex items-center gap-2'><LoadingSpinner size="sm"/> Translating...</div>}
                    {translationError && <p className="text-xs text-destructive mt-1">{translationError}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border">
                <SetupColumn columnId="A" title={titleA} onTitleChange={setTitleA} prompt={promptA} onPromptChange={setPromptA} requestReasoning={requestReasoningA} onRequestReasoningChange={setRequestReasoningA} />
                <SetupColumn columnId="B" title={titleB} onTitleChange={setTitleB} prompt={promptB} onPromptChange={setPromptB} requestReasoning={requestReasoningB} onRequestReasoningChange={setRequestReasoningB} />
            </div>
            <button
              onClick={handleRunExperiment}
              disabled={isRunExperimentDisabled()}
              className={`w-full bg-primary text-primary-foreground font-bold text-lg py-4 px-6 rounded-lg shadow-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex items-center justify-center transition-all duration-300 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none disabled:animate-none ${!isRunExperimentDisabled() ? 'animate-pulse-glow' : ''}`}>
                  {getButtonText()}
            </button>
          </div>
        </section>

        {(isLoading || responseA !== null || responseB !== null) && (
            <section className="mt-10">
                <h2 className="text-xl sm:text-2xl font-bold text-center text-foreground mb-8">2. LLM Responses</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <ReasoningResponseCard title={titleA} response={responseA} reasoning={reasoningA} isLoading={isLoading && !responseA} generationTime={generationTimeA} answerWordCount={answerWordCountA} reasoningWordCount={reasoningWordCountA} />
                    <ReasoningResponseCard title={titleB} response={responseB} reasoning={reasoningB} isLoading={isLoading && !responseB} generationTime={generationTimeB} answerWordCount={answerWordCountB} reasoningWordCount={reasoningWordCountB}/>
                </div>
            </section>
        )}

        {responseA !== null && responseB !== null && !isLoading && (
            <section className="bg-card text-card-foreground p-6 sm:p-8 rounded-xl shadow-md border border-border">
                <EvaluationForm 
                    titleA={titleA} titleB={titleB}
                    englishScores={currentScoresA} onEnglishScoresChange={setCurrentScoresA}
                    nativeScores={currentScoresB} onNativeScoresChange={setCurrentScoresB}
                    harmDisparityMetrics={currentHarmDisparityMetrics} onHarmDisparityMetricsChange={setCurrentHarmDisparityMetrics}
                    overallNotes={evaluationNotes} onOverallNotesChange={setEvaluationNotes}
                    onSubmit={handleEvaluationSubmit} disabled={isLoading}
                    isEditing={!!editingEvaluationId}
                    isManuallyFlaggedForReview={isManuallyFlaggedForReview} onIsManuallyFlaggedForReviewChange={setIsManuallyFlaggedForReview}
                    generationTimeEnglish={generationTimeA} generationTimeNative={generationTimeB}
                    wordCountEnglish={answerWordCountA} wordCountNative={answerWordCountB}
                    wordsPerSecondEnglish={wordsPerSecondA} wordsPerSecondNative={wordsPerSecondB}
                />
            </section>
        )}

        <section>
           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 pb-4 border-b border-border/70">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{currentUser.role === 'admin' ? 'All Comparison Reports' : 'My Comparison Reports'}</h2>
             <div className="flex items-center gap-4 mt-4 sm:mt-0">
                 <div className="bg-muted p-1 rounded-lg flex items-center text-sm font-medium">
                    <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-background/50'}`}>List</button>
                    <button onClick={() => setViewMode('dashboard')} className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'dashboard' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-background/50'}`}>Dashboard</button>
                 </div>
                 {visibleEvaluations.length > 0 && <button onClick={downloadCSV} className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all duration-200 text-sm flex items-center justify-center" aria-label="Download evaluations as CSV"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>Download Full Report</button>}
             </div>
          </div>

          {allEvaluations.length > 0 && (
            <div className="mb-6">
              <div className="relative max-w-md">
                <input
                  type="text"
                  placeholder="Search scenarios by prompt, context, or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                >
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing {visibleEvaluations.length} of {allEvaluations.length} evaluations
                </p>
              )}
            </div>
          )}
          {isLoadingEvaluations ? (
            <div className="text-center py-10"><LoadingSpinner size="lg" /></div>
          ) : visibleEvaluations.length === 0 ? (
            <div className="text-center py-10 bg-card border border-border rounded-xl shadow-sm">
              <p className="text-lg text-muted-foreground">
                {searchQuery ? `No evaluations found matching "${searchQuery}"` : 'No comparison evaluations saved yet.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-primary hover:underline text-sm"
                >
                  Clear search to see all evaluations
                </button>
              )}
            </div>
          ) : (
             viewMode === 'list' ? (
                <div className="space-y-8">
                  {visibleEvaluations.slice().reverse().map((ev) => {
                    const canEdit = currentUser.role === 'admin' || currentUser.email === ev.userEmail;
                    return (
                    <details key={ev.id} className={`bg-card text-card-foreground rounded-xl shadow-md border overflow-hidden transition-all duration-300 ${ev.isFlaggedForReview ? 'border-destructive ring-2 ring-destructive' : 'border-border'}`}>
                      <summary className="px-6 py-5 cursor-pointer list-none flex justify-between items-center hover:bg-muted/60">
                        <div className="flex-grow">
                            <h3 className="text-lg font-semibold text-primary">{ev.isFlaggedForReview && '🚩 '}{ev.titleA} vs. {ev.titleB}</h3>
                            <p className="text-xs text-muted-foreground mt-1">Model: {AVAILABLE_MODELS.find(m => m.id === ev.model)?.name || ev.model} | Evaluator: {ev.userEmail} | {new Date(ev.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="ml-4 flex-shrink-0 flex items-center gap-4">
                           {ev.llmEvaluationStatus === 'pending' && <Tooltip content="LLM evaluation in progress..."><LoadingSpinner size="sm" color="text-primary" /></Tooltip>}
                           {ev.llmEvaluationStatus === 'failed' && <Tooltip content={`LLM evaluation failed: ${ev.llmEvaluationError}`}><span className="text-destructive text-xl">⚠️</span></Tooltip>}
                           {ev.llmEvaluationStatus === 'completed' && <Tooltip content="LLM evaluation completed"><span className="text-accent text-xl">🤖</span></Tooltip>}
                           <div className="text-primary transition-transform duration-200 transform details-summary-marker"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg></div>
                        </div>
                      </summary>
                      <div className="px-6 py-6 border-t border-border bg-background/50 text-sm space-y-6">
                        {ev.scenarioContext && (
                            <div className="mb-4">
                                <h4 className="font-semibold text-foreground/90 mb-1.5 text-base">Scenario Context:</h4>
                                <p className="italic text-muted-foreground bg-muted p-3 rounded-md text-xs max-h-32 overflow-y-auto custom-scrollbar" tabIndex={0}>{ev.scenarioContext}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            <div><h4 className="font-semibold text-foreground/90 mb-1.5 text-base">{ev.titleA} Prompt:</h4><p className="italic text-muted-foreground bg-muted p-3 rounded-md text-xs max-h-32 overflow-y-auto custom-scrollbar" tabIndex={0}>{ev.promptA}</p></div>
                            <div><h4 className="font-semibold text-foreground/90 mb-1.5 text-base">{ev.titleB} Prompt:</h4><p className="italic text-muted-foreground bg-muted p-3 rounded-md text-xs max-h-32 overflow-y-auto custom-scrollbar" tabIndex={0}>{ev.promptB}</p></div>
                        </div>
                        
                        {ev.llmEvaluationStatus === 'completed' && ev.llmScores ? (
                            <EvaluationComparison 
                                humanScores={ev.humanScores}
                                llmScores={ev.llmScores}
                                humanNotes={ev.notes}
                                titleA={ev.titleA}
                                titleB={ev.titleB}
                            />
                        ) : (
                           <div className="text-center py-8 bg-muted rounded-lg">
                                <p className="text-muted-foreground">Evaluation comparison will be shown here once the LLM evaluation is complete.</p>
                                {ev.llmEvaluationStatus === 'pending' && <div className="mt-4 flex justify-center items-center gap-2"><LoadingSpinner size="sm"/><span>LLM evaluation in progress...</span></div>}
                                {ev.llmEvaluationStatus === 'failed' && <p className="mt-2 text-destructive">LLM evaluation failed: {ev.llmEvaluationError}</p>}
                           </div>
                        )}
                        
                        <div className="mt-6 flex justify-between items-center pt-4 border-t border-border/50">
                             <div className="flex items-center gap-2">
                                {canEdit && (
                                    <button
                                        onClick={() => handleStartEdit(ev.id)}
                                        className="px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 text-primary hover:bg-primary/10"
                                        aria-label="Edit this evaluation"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg>
                                        <span>Edit</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDeleteEvaluation(ev.id)}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 text-destructive hover:bg-destructive/10"
                                    aria-label="Delete this evaluation"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 01-8.832 0v-.227a3 3 0 013-3h2.666a3 3 0 013 3zM3.5 6A1.5 1.5 0 002 7.5v9A1.5 1.5 0 003.5 18h13a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0016.5 6h-13zM8 10a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 10zm4 0a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0112 10z" clipRule="evenodd" /></svg>
                                    <span>Delete Evaluation</span>
                                </button>
                             </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleToggleFlagForReview(ev.id)} className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-all duration-200 flex items-center gap-2 ${ev.isFlaggedForReview ? 'bg-destructive/80 text-destructive-foreground hover:bg-destructive' : 'bg-secondary text-secondary-foreground hover:bg-muted'}`} aria-label={ev.isFlaggedForReview ? 'Unflag this evaluation' : 'Flag this evaluation for admin review'}>
                                    {ev.isFlaggedForReview ? '🚩 Unflag' : 'Flag for Review'}
                                </button>
                            </div>
                        </div>
                      </div>
                    </details>
                  )})}
                </div>
            ) : (
                <ReasoningDashboard evaluations={visibleEvaluations} />
            )
          )}
        </section>
    </div>
  );
};

export default ReasoningLab;
