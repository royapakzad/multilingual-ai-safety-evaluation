

import React, { useMemo, useState } from 'react';
import { ReasoningEvaluationRecord, LanguageSpecificRubricScores, RubricDimension, LlmRubricScores } from '../types';
import { DISPARITY_CRITERIA, RUBRIC_DIMENSIONS, AVAILABLE_MODELS, isDimensionVisibleForRecord, isDisparityKeyVisibleForRecord } from '../constants';
import LoadingSpinner from './LoadingSpinner';
import Tooltip from './Tooltip';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// --- HELPER COMPONENTS ---

const DashboardCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string; id?: string }> = ({ title, subtitle, children, className = '', id }) => (
    <div id={id} className={`bg-card text-card-foreground p-6 rounded-xl shadow-md border border-border ${className}`}>
        <div className="border-b border-border mb-4 pb-3">
             <h3 className="text-lg font-semibold text-foreground">{title}</h3>
             {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {children}
    </div>
);


const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; tooltip?: React.ReactNode }> = ({ label, value, icon, tooltip }) => (
    <div className="bg-background p-4 rounded-lg flex items-center gap-4 border border-border/70 shadow-sm">
        <div className="bg-primary/10 text-primary p-3 rounded-lg">
            {icon}
        </div>
        <div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                <span>{label}</span>
                {tooltip && (
                    <Tooltip content={tooltip}>
                        <span className="cursor-help border border-dashed border-muted-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs">?</span>
                    </Tooltip>
                )}
            </div>
        </div>
    </div>
);

const BarChart: React.FC<{ data: { label: string; valueA: number; valueB: number; unit: string }[] }> = ({ data }) => {
    const totalData = data.map(d => ({...d, total: d.valueA + d.valueB}));
    return (
        <div className="space-y-4 text-sm">
            {totalData.map(({ label, valueA, valueB, unit, total }) => {
                const percentA = total > 0 ? (valueA / total) * 100 : 50;
                return (
                    <div key={label}>
                        <div className="flex justify-between items-center mb-1 text-muted-foreground">
                            <span className="font-medium text-foreground">{label}</span>
                            <div className="flex gap-4 font-mono">
                                <span className="text-blue-500">{valueA.toFixed(2)}{unit}</span>
                                <span className="text-violet-400">{valueB.toFixed(2)}{unit}</span>
                            </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-4 flex overflow-hidden">
                            <div className="bg-blue-500 h-full" style={{ width: `${percentA}%` }}></div>
                            <div className="bg-violet-400 h-full" style={{ width: `${100-percentA}%` }}></div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
};


// Define types inside the component file for clarity
interface RadarChartDimensionData {
    key: string;
    label: string;
    fullLabel: string;
    description: string;
    humanRightsMapping: { name: string; description: string; }[];
}

const RadarChart: React.FC<{ 
    data: { 
        dimensionData: RadarChartDimensionData[], 
        datasets: { label: string; color: string; values: number[], dashed?: boolean }[] 
    };
    onLabelClick: (dimensionKey: string, dimensionLabel: string) => void;
}> = ({ data, onLabelClick }) => {
    const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string } | null>(null);

    const size = 500; // Increased size for better visibility
    const center = size / 2;
    const numLevels = 5;
    const radius = center * 0.6; // Adjusted radius for the new size
    const levelDistance = radius / numLevels;
    const numAxes = data.dimensionData.length;

    const getPointCoordinates = (value: number, index: number) => {
        const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2;
        const distance = (value / numLevels) * radius;
        return {
            x: center + distance * Math.cos(angle),
            y: center + distance * Math.sin(angle),
        };
    };

    const points = data.datasets.map(dataset => 
        dataset.values.map((value, i) => {
            const { x, y } = getPointCoordinates(value, i);
            return `${x},${y}`;
        }).join(' ')
    );

    return (
        <div className="relative flex flex-col items-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Levels and Axes */}
                {[...Array(numLevels)].map((_, level) => (
                    <circle key={level} cx={center} cy={center} r={levelDistance * (level + 1)} fill="none" stroke="var(--color-border)" strokeWidth="1" />
                ))}
                {data.dimensionData.map((_, i) => {
                    const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
                    return <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="var(--color-border)" />;
                })}
                {/* Data Polygons */}
                {points.map((p, i) => (
                     <polygon 
                        key={i} 
                        points={p} 
                        fill={data.datasets[i].color} 
                        fillOpacity="0.15" 
                        stroke={data.datasets[i].color} 
                        strokeWidth="2" 
                        strokeDasharray={data.datasets[i].dashed ? "5 5" : "none"}
                    />
                ))}
                 {/* Hover Hotspots */}
                {data.datasets.map(dataset => 
                    dataset.values.map((value, i) => {
                        const { x, y } = getPointCoordinates(value, i);
                        return (
                            <circle
                                key={`${dataset.label}-${i}`}
                                cx={x}
                                cy={y}
                                r="6" // hover radius
                                fill="transparent"
                                onMouseEnter={() => setTooltip({ x, y: y - 12, text: `${dataset.label}: ${value.toFixed(2)}`})}
                                onMouseLeave={() => setTooltip(null)}
                                className="cursor-pointer"
                            />
                        );
                    })
                )}
                {/* Labels */}
                {data.dimensionData.map((dim, i) => {
                    const angle = (Math.PI * 2 * i) / numAxes - Math.PI / 2;
                    const labelRadius = radius + 65; // Increased radius to give labels more room
                    const x = center + labelRadius * Math.cos(angle);
                    const y = center + labelRadius * Math.sin(angle);
                    
                    const foWidth = 160;
                    const foHeight = 50;

                    // Center the foreignObject on the calculated point
                    const foX = x - foWidth / 2;
                    const foY = y - foHeight / 2;

                    const lines = dim.label.split(' & ');

                    return (
                        <foreignObject key={dim.label} x={foX} y={foY} width={foWidth} height={foHeight} style={{ overflow: 'visible' }}>
                            <div className="flex items-center justify-center p-1 text-center h-full w-full">
                                <span className="text-xs sm:text-sm text-muted-foreground cursor-pointer hover:text-primary hover:font-bold" onClick={() => onLabelClick(dim.key, dim.fullLabel)}>
                                     {lines.map((line, index) => <div key={index}>{line}</div>)}
                                </span>
                            </div>
                        </foreignObject>
                    );
                })}
            </svg>
             {tooltip && (
                <div
                    className="absolute bg-popover text-popover-foreground text-xs font-semibold px-2 py-1 rounded-md shadow-lg pointer-events-none transition-opacity duration-200"
                    style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%)' }}
                >
                    {tooltip.text}
                </div>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-xs justify-center">
                {data.datasets.map(d => (
                    <div key={d.label} className="flex items-center gap-1.5">
                        <svg width="24" height="12" viewBox="0 0 24 12" className="flex-shrink-0">
                           <line
                               x1="0" y1="6" x2="24" y2="6"
                               stroke={d.color}
                               strokeWidth="2"
                               strokeDasharray={d.dashed ? "4 4" : "none"}
                           />
                        </svg>
                        <span>{d.label}</span>
                    </div>
                ))}
            </div>

            {/* Radar Chart Scores Table */}
            <div className="mt-6 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Dimension</th>
                            {data.datasets.map(dataset => (
                                <th key={dataset.label} className="text-center py-2 px-3 font-medium" style={{ color: dataset.color }}>
                                    {dataset.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.dimensionData.map((dimension, index) => (
                            <tr key={dimension.key} className="border-b border-border/50 hover:bg-muted/30">
                                <td className="py-2 px-3 font-medium text-foreground">{dimension.label}</td>
                                {data.datasets.map(dataset => (
                                    <td key={dataset.label} className="text-center py-2 px-3 font-mono font-semibold" style={{ color: dataset.color }}>
                                        {dataset.values[index]?.toFixed(2) || 'N/A'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const StackedBarChart: React.FC<{
    humanData: { label: string, yes: number, no: number, unsure: number, total: number }[];
    llmData: { label: string, yes: number, no: number, unsure: number, total: number }[] | null;
    onBarClick: (label: string, category: 'yes' | 'no' | 'unsure', source: 'human' | 'llm') => void;
}> = ({ humanData, llmData, onBarClick }) => (
    <div className="space-y-6 text-sm">
        {humanData.map((d, index) => {
            const yesPercent = d.total > 0 ? (d.yes / d.total) * 100 : 0;
            const noPercent = d.total > 0 ? (d.no / d.total) * 100 : 0;
            const unsurePercent = 100 - yesPercent - noPercent;

            const llmItem = llmData ? llmData[index] : null;
            const llmYesPercent = llmItem && llmItem.total > 0 ? (llmItem.yes / llmItem.total) * 100 : 0;
            const llmNoPercent = llmItem && llmItem.total > 0 ? (llmItem.no / llmItem.total) * 100 : 0;
            const llmUnsurePercent = llmItem ? 100 - llmYesPercent - llmNoPercent : 0;

            return (
                <div key={d.label}>
                    <p className="font-medium text-foreground mb-2">{d.label}</p>
                    
                    {/* Human Bar */}
                    <div className="flex items-center gap-3">
                        <span className="w-12 text-right text-muted-foreground text-xs shrink-0">👤 Human</span>
                        <div className="flex-grow">
                            <div className="w-full flex h-5 rounded-md overflow-hidden bg-muted">
                                <button className="bg-destructive hover:opacity-80 transition-opacity" style={{ width: `${yesPercent}%` }} title={`Yes: ${d.yes}`} onClick={() => onBarClick(d.label, 'yes', 'human')}></button>
                                <button className="bg-emerald-500 hover:opacity-80 transition-opacity" style={{ width: `${noPercent}%` }} title={`No: ${d.no}`} onClick={() => onBarClick(d.label, 'no', 'human')}></button>
                                <button className="bg-slate-400 hover:opacity-80 transition-opacity" style={{ width: `${unsurePercent}%` }} title={`Unsure: ${d.unsure}`} onClick={() => onBarClick(d.label, 'unsure', 'human')}></button>
                            </div>
                            <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                                <span>{d.yes} Yes</span>
                                <span>{d.no} No</span>
                                <span>{d.unsure} Unsure</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* LLM Bar */}
                    {llmItem && (
                        <div className="flex items-center gap-3 mt-2">
                            <span className="w-12 text-right text-muted-foreground text-xs shrink-0">🤖 LLM</span>
                            <div className="flex-grow">
                                {llmItem.total > 0 ? (
                                    <>
                                        <div className="w-full flex h-5 rounded-md overflow-hidden bg-muted">
                                            <button className="bg-red-400 hover:bg-destructive transition-colors" style={{ width: `${llmYesPercent}%` }} title={`Yes: ${llmItem.yes}`} onClick={() => onBarClick(d.label, 'yes', 'llm')}></button>
                                            <button className="bg-emerald-400 hover:bg-emerald-500 transition-colors" style={{ width: `${llmNoPercent}%` }} title={`No: ${llmItem.no}`} onClick={() => onBarClick(d.label, 'no', 'llm')}></button>
                                            <button className="bg-slate-300 hover:bg-slate-400 transition-colors" style={{ width: `${llmUnsurePercent}%` }} title={`Unsure: ${llmItem.unsure}`} onClick={() => onBarClick(d.label, 'unsure', 'llm')}></button>
                                        </div>
                                        <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                                            <span>{llmItem.yes} Yes</span>
                                            <span>{llmItem.no} No</span>
                                            <span>{llmItem.unsure} Unsure</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-xs text-muted-foreground italic h-5 flex items-center">No LLM data for this item.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )
        })}
    </div>
);

const MultiLanguageHeatmapCell: React.FC<{
    language: string;
    dimensionLabel: string;
    value: number;
    avgScoreA: number;
    avgScoreB: number;
    count: number;
    maxValue: number;
}> = ({ language, dimensionLabel, value, avgScoreA, avgScoreB, count, maxValue }) => {
    // Normalize value from 0 to 1 for color calculation
    const intensity = maxValue > 0 ? value / maxValue : 0;
    // Interpolate hue from yellow-green (80) to red (0) for a softer, more professional gradient
    const hue = 50 - (intensity * 50); 
    const saturation = 90;
    const lightness = 88 - (intensity * 33); // from a very light pastel yellow to a softer red.
    const backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    // Use light text on darker backgrounds for readability
    const textColor = lightness < 60 ? 'var(--color-primary-foreground)' : 'var(--color-foreground)';

    return (
        <div
            className="p-2 rounded-md flex flex-col justify-center items-center text-center border border-transparent transition-transform duration-200 hover:scale-110 hover:z-10 hover:shadow-lg hover:border-ring"
            style={{ backgroundColor, color: textColor }}
            title={`${language} - ${dimensionLabel}\nAvg Disparity: ${value.toFixed(2)}\n(Eng: ${avgScoreA.toFixed(2)}, Nat: ${avgScoreB.toFixed(2)})\nBased on ${count} evaluations`}
        >
            <span className="font-bold text-base">{value.toFixed(2)}</span>
            <span className="text-xs opacity-80 leading-tight">({avgScoreA.toFixed(1)}, {avgScoreB.toFixed(1)})</span>
        </div>
    );
};


const DrilldownModal: React.FC<{ data: { title: string; evaluations: ReasoningEvaluationRecord[] }; onClose: () => void }> = ({ data, onClose }) => {
    if (!data) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-border">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-foreground">{data.title} ({data.evaluations.length})</h2>
                        <button onClick={onClose} className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                        </button>
                    </div>
                </div>
                <div className="p-6 flex-grow overflow-y-auto custom-scrollbar">
                    <ul className="space-y-3">
                        {data.evaluations.length > 0 ? data.evaluations.map(ev => (
                            <li key={ev.id} className="p-3 bg-background rounded-lg border border-border/70">
                                <p className="font-semibold text-primary">{ev.titleA} vs {ev.titleB}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Model: {ev.model} | {new Date(ev.timestamp).toLocaleString()}
                                </p>
                            </li>
                        )) : <p className="text-muted-foreground italic">No evaluations found for this category.</p>}
                    </ul>
                </div>
            </div>
        </div>
    )
}

// Custom criteria can have any number of evaluator-written options (unlike the fixed
// yes/no/unsure of StackedBarChart above), so this cycles through a fixed palette rather
// than assuming a specific option count.
const CUSTOM_OPTION_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const OptionDistributionBar: React.FC<{
    rowLabel: string;
    options: string[];
    counts: Record<string, number>;
}> = ({ rowLabel, options, counts }) => {
    const total = options.reduce((sum, opt) => sum + (counts[opt] ?? 0), 0);
    return (
        <div className="flex items-center gap-3">
            <span className="w-16 text-right text-muted-foreground text-xs shrink-0">{rowLabel}</span>
            <div className="flex-grow">
                {total > 0 ? (
                    <>
                        <div className="w-full flex h-5 rounded-md overflow-hidden bg-muted">
                            {options.map((opt, i) => {
                                const count = counts[opt] ?? 0;
                                const percent = (count / total) * 100;
                                return percent > 0 ? (
                                    <div key={opt} style={{ width: `${percent}%`, backgroundColor: CUSTOM_OPTION_COLORS[i % CUSTOM_OPTION_COLORS.length] }} title={`${opt}: ${count}`} />
                                ) : null;
                            })}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-1 text-muted-foreground">
                            {options.map((opt, i) => (
                                <span key={opt} className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: CUSTOM_OPTION_COLORS[i % CUSTOM_OPTION_COLORS.length] }} />
                                    {opt}: {counts[opt] ?? 0}
                                </span>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="text-center text-xs text-muted-foreground italic h-5 flex items-center">No data.</div>
                )}
            </div>
        </div>
    );
};

const AgreementRateChart: React.FC<{data: {label: string, agreement: number}[]}> = ({data}) => (
    <div className="space-y-3">
        {data.map(item => (
            <div key={item.label}>
                <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-foreground">{item.label}</span>
                    <span className="font-mono text-muted-foreground">{item.agreement.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-muted h-2.5 rounded-full">
                    <div className="bg-gradient-to-r from-blue-400 to-primary h-2.5 rounded-full" style={{width: `${item.agreement}%`}}></div>
                </div>
            </div>
        ))}
    </div>
)

// A helper to shorten labels just for the dashboard display
const getShortLabel = (longLabel: string): string => {
    const labelMap: { [key: string]: string } = {
        'Actionability and Practicality': 'Actionability & Practicality',
        'Factuality': 'Factuality',
        'Safety, Security, and Privacy': 'Safety, Security & Privacy',
        'Tone, Dignity, and Empathy': 'Tone, Dignity & Empathy',
        'Non-Discrimination & Fairness': 'Fairness & Bias',
        'Freedom of Access to Information, Censorship and Refusal': 'Censorship & Refusal',
    };
    return labelMap[longLabel] || longLabel;
};


const MODEL_COLORS: { [key: string]: string } = {
    'gemini/gemini-2.5-flash': '#4285F4',
    'openai/gpt-4o': '#10a37f',
    'mistral/mistral-small-latest': '#ff7755',
    'default': '#5f6368',
};

const GroupedBarChart: React.FC<{
    data: { label: string; values: { [modelId: string]: number } }[];
    modelColors: { [modelId: string]: string };
    maxValue?: number;
    unit?: string;
}> = ({ data, modelColors, maxValue = 5, unit = '' }) => {
    const models = data.length > 0 ? Object.keys(data[0].values).sort() : [];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
                {models.map(modelId => (
                    <div key={modelId} className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: modelColors[modelId] || modelColors.default }}></span>
                        <span>{AVAILABLE_MODELS.find(m => m.id === modelId)?.name || modelId}</span>
                    </div>
                ))}
            </div>
            <div className="space-y-3 text-sm">
                {data.map(({ label, values }) => (
                    <div key={label}>
                        <p className="font-medium text-foreground mb-1.5">{label}</p>
                        <div className="space-y-1.5">
                            {models.map(modelId => {
                                const value = values[modelId] ?? 0;
                                const widthPercent = (value / maxValue) * 100;
                                const color = modelColors[modelId] || modelColors.default;
                                return (
                                    <div key={modelId} className="flex items-center gap-2.5 group">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></div>
                                        <div className="flex-grow bg-muted rounded h-3 relative">
                                            <div className="h-3 rounded transition-all duration-300" style={{ width: `${widthPercent}%`, backgroundColor: color }}></div>
                                             <span className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold transition-opacity duration-200 opacity-0 group-hover:opacity-100 pointer-events-none">{value.toFixed(2)}{unit}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CompactPerformanceChart: React.FC<{
    data: {
        title: string;
        data: { modelId: string, modelName: string, valueA: number, valueB: number }[];
        unit: string;
    }[];
}> = ({ data }) => {
    if (!data || data.length === 0) return null;
    const models = data[0].data; // Assumes all metrics have the same models
    const metrics = data.map(m => ({ title: m.title, unit: m.unit }));

    return (
        <div className="space-y-4">
            {models.map(model => {
                // Find the data for this specific model across all metrics
                const modelMetrics = metrics.map(metricInfo => {
                    const metricDataset = data.find(d => d.title === metricInfo.title);
                    const modelData = metricDataset?.data.find(d => d.modelId === model.modelId);
                    // Find max value for this specific metric for normalization
                    const maxValue = Math.max(1, ...(metricDataset?.data.map(d => Math.max(d.valueA, d.valueB)) || [1]));
                    return { ...metricInfo, ...modelData, maxValue };
                });

                return (
                    <div key={model.modelId} className="p-3 bg-background rounded-lg border border-border/60">
                        <h5 className="font-semibold text-foreground text-xs mb-3">{model.modelName}</h5>
                        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                            {modelMetrics.map(metric => (
                                <div key={metric.title}>
                                    <p className="text-[11px] font-medium text-muted-foreground truncate mb-1" title={metric.title}>{metric.title.split('(')[0]}</p>
                                    {/* Bar for A (English) */}
                                    <div className="w-full bg-muted rounded h-3.5 relative group">
                                        <div className="bg-blue-500 h-3.5 rounded" style={{ width: `${((metric.valueA ?? 0) / metric.maxValue) * 100}%` }}></div>
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{(metric.valueA ?? 0).toFixed(2)}{metric.unit}</div>
                                    </div>
                                    {/* Bar for B (Native) */}
                                    <div className="w-full bg-muted rounded h-3.5 relative group mt-1">
                                        <div className="bg-violet-400 h-3.5 rounded" style={{ width: `${((metric.valueB ?? 0) / metric.maxValue) * 100}%` }}></div>
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{(metric.valueB ?? 0).toFixed(2)}{metric.unit}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ContextScatterPlot: React.FC<{
    data: { context: string; humanValue: number; llmValue: number }[];
    title: string;
    domain: [number, number];
    topDisparityContexts: Set<string>;
    quadrantLabels: {
        topRight: string;
        topLeft: string;
        bottomLeft: string;
        bottomRight: string;
    };
}> = ({ data, title, domain, topDisparityContexts, quadrantLabels }) => {
    const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string, human: number, llm: number } | null>(null);

    const size = 350;
    const padding = 40;
    const [domainMin, domainMax] = domain;
    const domainRange = domainMax - domainMin;

    const midPoint = domainMin + domainRange / 2;

    const scale = (val: number) => {
        if (domainRange === 0) return padding;
        return padding + ((val - domainMin) / domainRange) * (size - 2 * padding);
    };
    const scaleY = (val: number) => {
        if (domainRange === 0) return size - padding;
        return (size - padding) - ((val - domainMin) / domainRange) * (size - 2 * padding);
    };

    if (data.length === 0) {
        return <p className="text-center text-muted-foreground italic py-8">No overlapping context data to display.</p>
    }

    const ticks = Array.from({ length: domainMax - domainMin + 1 }, (_, i) => i + domainMin);

    return (
        <div className="relative flex flex-col items-center">
            <h4 className="font-semibold text-foreground mb-2 text-sm text-center">{title}</h4>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Quadrant Backgrounds and Labels */}
                <g className="text-[9px] fill-muted-foreground opacity-60">
                    <rect x={scale(midPoint)} y={padding} width={scale(domainMax) - scale(midPoint)} height={scaleY(midPoint) - padding} fill="var(--color-background)" />
                    <text x={scale(midPoint + domainRange / 4)} y={padding + 10} textAnchor="middle">{quadrantLabels.topRight}</text>

                    <rect x={padding} y={padding} width={scale(midPoint) - padding} height={scaleY(midPoint) - padding} fill="var(--color-muted)" />
                    <text x={scale(midPoint - domainRange / 4)} y={padding + 10} textAnchor="middle">{quadrantLabels.topLeft}</text>

                    <rect x={padding} y={scaleY(midPoint)} width={scale(midPoint) - padding} height={size - padding - scaleY(midPoint)} fill="var(--color-background)" />
                    <text x={scale(midPoint - domainRange / 4)} y={size - padding - 10} textAnchor="middle">{quadrantLabels.bottomLeft}</text>

                    <rect x={scale(midPoint)} y={scaleY(midPoint)} width={scale(domainMax) - scale(midPoint)} height={size - padding - scaleY(midPoint)} fill="var(--color-muted)" />
                    <text x={scale(midPoint + domainRange / 4)} y={size - padding - 10} textAnchor="middle">{quadrantLabels.bottomRight}</text>
                </g>

                {/* Axes and Grid */}
                {ticks.map((i) => {
                    const pos = scale(i);
                    const posY = scaleY(i);
                    return (
                        <g key={i} className="text-muted-foreground text-[10px]">
                            {/* Horizontal grid line */}
                            <line x1={padding} y1={posY} x2={size - padding} y2={posY} stroke="var(--color-border)" strokeDasharray="2,2" />
                            <text x={padding - 8} y={posY} textAnchor="end" dominantBaseline="middle">{i}</text>
                            {/* Vertical grid line */}
                            <line x1={pos} y1={padding} x2={pos} y2={size - padding} stroke="var(--color-border)" strokeDasharray="2,2" />
                            <text x={pos} y={size - padding + 15} textAnchor="middle">{i}</text>
                        </g>
                    );
                })}
                 <text x={size/2} y={size - 5} textAnchor="middle" className="font-semibold fill-foreground text-xs">👤 Human Score</text>
                 <text x={10} y={size/2} textAnchor="middle" transform={`rotate(-90, 10, ${size/2})`} className="font-semibold fill-foreground text-xs">🤖 LLM Score</text>

                {/* Line of Perfect Agreement */}
                <line x1={scale(domainMin)} y1={scaleY(domainMin)} x2={scale(domainMax)} y2={scaleY(domainMax)} stroke="var(--color-accent)" strokeWidth="1" strokeDasharray="4,4" />
                
                {/* Data Points */}
                {data.map((d, i) => {
                    const isTopDisparity = topDisparityContexts.has(d.context);
                    // Clip values to be within the domain for plotting
                    const humanValue = Math.max(domainMin, Math.min(domainMax, d.humanValue));
                    const llmValue = Math.max(domainMin, Math.min(domainMax, d.llmValue));
                    return (
                    <circle
                        key={i}
                        cx={scale(humanValue)}
                        cy={scaleY(llmValue)}
                        r={isTopDisparity ? 6 : 4}
                        fill={isTopDisparity ? 'var(--color-destructive)' : 'var(--color-primary)'}
                        fillOpacity="0.8"
                        stroke="var(--color-primary-foreground)"
                        strokeWidth="1"
                        className="cursor-pointer transition-all duration-150 hover:r-7 hover:fill-primary-hover"
                        onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const svgRect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                            setTooltip({ x: rect.left - svgRect.left, y: rect.top - svgRect.top, text: d.context, human: d.humanValue, llm: d.llmValue });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                    />
                )})}
            </svg>
             {tooltip && (
                <div
                    className="absolute bg-popover text-popover-foreground text-xs px-3 py-2 rounded-lg shadow-xl pointer-events-none max-w-xs z-10"
                    style={{ left: tooltip.x, top: tooltip.y, transform: `translate(10px, -110%)` }}
                >
                   <p className="font-bold mb-1 truncate">{tooltip.text}</p>
                   <p>Human: <span className="font-mono">{tooltip.human.toFixed(2)}</span></p>
                   <p>LLM: <span className="font-mono">{tooltip.llm.toFixed(2)}</span></p>
                </div>
            )}
        </div>
    );
};


// --- MAIN COMPONENT ---

interface ReasoningDashboardProps {
    evaluations: ReasoningEvaluationRecord[];
}

const SCORE_QUADRANT_LABELS = {
    topRight: 'High Agreement (Good Scores)',
    topLeft: 'Disagreement (LLM Overestimates)',
    bottomLeft: 'High Agreement (Bad Scores)',
    bottomRight: 'Disagreement (LLM Underestimates)',
};

const DISPARITY_QUADRANT_LABELS = {
    topRight: 'High Agreement (High Disparity)',
    topLeft: 'Disagreement (LLM Overestimates)',
    bottomLeft: 'High Agreement (Low Disparity)',
    bottomRight: 'Disagreement (LLM Underestimates)',
};


const ReasoningDashboard: React.FC<ReasoningDashboardProps> = ({ evaluations }) => {
    const [drilldownData, setDrilldownData] = useState<{ title: string; evaluations: ReasoningEvaluationRecord[] } | null>(null);
    const [selectedLanguagePair, setSelectedLanguagePair] = useState<string>('All');
    const [selectedModel, setSelectedModel] = useState<string>('All');
    const [contextSortBy, setContextSortBy] = useState<'disparity' | 'english' | 'native'>('disparity');
    const [topNContexts, setTopNContexts] = useState<number>(5);
    const [contextView, setContextView] = useState<'list' | 'plot'>('list');


    const languagePairs = useMemo(() => {
        const pairs = new Set(
            evaluations
                .map(e => `${e.titleA || 'Untitled'} - ${e.titleB || 'Untitled'}`)
                .filter(pair => pair && pair.toLowerCase() !== 'english - english')
        );
        return ['All', ...Array.from(pairs).sort()];
    }, [evaluations]);
    
    const models = useMemo(() => {
        const modelIds = new Set(evaluations.map(e => e.model).filter(Boolean));
        return ['All', ...Array.from(modelIds)];
    }, [evaluations]);

    const filteredEvaluations = useMemo(() => {
        let filtered = evaluations.filter(e => {
            const pair = `${e.titleA || 'Untitled'} - ${e.titleB || 'Untitled'}`;
            return pair.toLowerCase() !== 'english - english';
        });

        if (selectedLanguagePair !== 'All') {
            filtered = filtered.filter(e => `${e.titleA || 'Untitled'} - ${e.titleB || 'Untitled'}` === selectedLanguagePair);
        }
        if (selectedModel !== 'All') {
            filtered = filtered.filter(e => e.model === selectedModel);
        }
        return filtered;
    }, [evaluations, selectedLanguagePair, selectedModel]);

    
    const getNumericScore = (key: keyof (LanguageSpecificRubricScores | LlmRubricScores), score: (LanguageSpecificRubricScores | LlmRubricScores)) => {
        const scoreMap: { [key: string]: number } = {
            'no_harm_detected': 5, 'safe_and_dignified': 5, 'respectful_of_freedoms': 5,
            'subtle_or_potential_harm': 3, 'potential_risk_undignified': 3, 'potential_infringement': 3,
            'overt_or_severe_harm': 1, 'clear_and_present_danger': 1, 'clear_violation': 1,
        };
        const val = score[key as keyof typeof score];
        if (typeof val === 'number') return val;
        return scoreMap[val as string] || 3;
    };
    
    const metrics = useMemo(() => {
        if (filteredEvaluations.length === 0) return null;
        const totalEvals = filteredEvaluations.length;
        const withReasoningA = filteredEvaluations.filter(e => e.reasoningRequestedA);
        const withReasoningB = filteredEvaluations.filter(e => e.reasoningRequestedB);

        const totalTimeA = filteredEvaluations.reduce((acc, curr) => acc + (curr.generationTimeSecondsA ?? 0), 0);
        const totalTimeB = filteredEvaluations.reduce((acc, curr) => acc + (curr.generationTimeSecondsB ?? 0), 0);
        const totalWordsA = filteredEvaluations.reduce((acc, curr) => acc + curr.answerWordCountA, 0);
        const totalWordsB = filteredEvaluations.reduce((acc, curr) => acc + curr.answerWordCountB, 0);
        
        return {
            totalEvaluations: totalEvals,
            uniqueScenarios: new Set(filteredEvaluations.map(e => e.scenarioId)).size,
            modelsTested: new Set(filteredEvaluations.map(e => e.model)).size,
            avgTimeA: totalEvals > 0 ? totalTimeA / totalEvals : 0,
            avgTimeB: totalEvals > 0 ? totalTimeB / totalEvals : 0,
            avgWordsA: totalEvals > 0 ? totalWordsA / totalEvals : 0,
            avgWordsB: totalEvals > 0 ? totalWordsB / totalEvals : 0,
            avgReasoningWordsA: withReasoningA.length > 0 ? withReasoningA.reduce((acc, curr) => acc + curr.reasoningWordCountA, 0) / withReasoningA.length : 0,
            avgReasoningWordsB: withReasoningB.length > 0 ? withReasoningB.reduce((acc, curr) => acc + curr.reasoningWordCountB, 0) / withReasoningB.length : 0,
            avgWordsPerSecondA: totalTimeA > 0 ? totalWordsA / totalTimeA : 0,
            avgWordsPerSecondB: totalTimeB > 0 ? totalWordsB / totalTimeB : 0,
        };
    }, [filteredEvaluations]);


    const humanRadarChartData = useMemo(() => {
        if (filteredEvaluations.length === 0) return null;
        const dimensionsToInclude = ['actionability_practicality', 'factuality', 'safety_security_privacy', 'tone_dignity_empathy', 'non_discrimination_fairness', 'freedom_of_access_censorship'] as const;

        const dimensionData = RUBRIC_DIMENSIONS
            .filter(dim => (dimensionsToInclude as readonly string[]).includes(dim.key))
            .map(dim => ({
                key: dim.key,
                label: getShortLabel(dim.label),
                fullLabel: dim.label,
                description: dim.description,
                humanRightsMapping: dim.humanRightsMapping
            }));

        const sumA = Array(dimensionData.length).fill(0);
        const sumB = Array(dimensionData.length).fill(0);
        // Per-dimension count — a record that removed this dimension from its evaluation
        // must not count toward its average (or its denominator).
        const countPerDim = Array(dimensionData.length).fill(0);

        filteredEvaluations.forEach(ev => {
            if (ev.humanScores?.english && ev.humanScores?.native) {
                dimensionData.forEach((dim, i) => {
                    if (!isDimensionVisibleForRecord(ev.hiddenBuiltInKeys, dim.key)) return;
                    sumA[i] += getNumericScore(dim.key, ev.humanScores.english);
                    sumB[i] += getNumericScore(dim.key, ev.humanScores.native);
                    countPerDim[i]++;
                });
            }
        });

        const avgScoresA = sumA.map((v, i) => countPerDim[i] > 0 ? v / countPerDim[i] : 0);
        const avgScoresB = sumB.map((v, i) => countPerDim[i] > 0 ? v / countPerDim[i] : 0);

        return {
            dimensionData,
            datasets: [
                { label: 'Human - English', color: '#3b82f6', values: avgScoresA, dashed: false }, // blue-500
                { label: 'Human - Native', color: '#a855f7', values: avgScoresB, dashed: false }, // purple-500
            ],
        };
    }, [filteredEvaluations]);

    const llmRadarChartData = useMemo(() => {
        const llmCompletedEvals = filteredEvaluations.filter(e => e.llmEvaluationStatus === 'completed' && e.llmScores);
        if (llmCompletedEvals.length === 0) return null;

        const dimensions = RUBRIC_DIMENSIONS.map(d => d.key);

        const sumLlmA = dimensions.map(() => 0);
        const sumLlmB = dimensions.map(() => 0);
        const countPerDim = dimensions.map(() => 0);

        llmCompletedEvals.forEach(ev => {
            if (ev.llmScores?.english && ev.llmScores?.native) {
                dimensions.forEach((dim, i) => {
                    if (!isDimensionVisibleForRecord(ev.hiddenBuiltInKeys, dim)) return;
                    sumLlmA[i] += getNumericScore(dim as any, ev.llmScores.english);
                    sumLlmB[i] += getNumericScore(dim as any, ev.llmScores.native);
                    countPerDim[i]++;
                });
            }
        });

        const count = llmCompletedEvals.length;
        const avgLlmA = sumLlmA.map((v, i) => countPerDim[i] > 0 ? v / countPerDim[i] : 0);
        const avgLlmB = sumLlmB.map((v, i) => countPerDim[i] > 0 ? v / countPerDim[i] : 0);

        return {
            datasets: [
                { label: 'LLM - English', color: '#60a5fa', values: avgLlmA, dashed: true }, // blue-400
                { label: 'LLM - Native', color: '#c084fc', values: avgLlmB, dashed: true }, // purple-400
            ],
            evalCount: count,
        };
    }, [filteredEvaluations]);

    // FIX: Refactor to fix 'unknown' key type issue by removing problematic `in` check.
    // hiddenBuiltInKeys scopes the average to only the dimensions actually active for the
    // record these `scores` came from — a removed dimension's unscored default must not
    // pull the "overall score" toward it.
    const calculateOverallScore = (scores: LanguageSpecificRubricScores | LlmRubricScores, hiddenBuiltInKeys: string[] = []): number => {
        const dimensionKeys = RUBRIC_DIMENSIONS.filter(d => isDimensionVisibleForRecord(hiddenBuiltInKeys, d.key)).map(d => d.key);
        if (dimensionKeys.length === 0) return 0;
        const totalScore = dimensionKeys.reduce((acc, key) => {
            // The `key` from RUBRIC_DIMENSIONS is guaranteed to be a key of the scores object.
            // We cast it to tell typescript what we know.
            const scoreKey = key as keyof typeof scores;
            return acc + getNumericScore(scoreKey, scores);
        }, 0);
        return totalScore / dimensionKeys.length;
    };

    const { contextAnalysisData, top5DisparateContexts } = useMemo(() => {
        if (filteredEvaluations.length === 0) return { contextAnalysisData: null, top5DisparateContexts: new Set<string>() };

        const contextMap = new Map<string, { englishScores: number[], nativeScores: number[], disparities: number[], evaluations: ReasoningEvaluationRecord[] }>();
        
        filteredEvaluations.forEach(ev => {
            if (!ev.scenarioContext || !ev.humanScores) return;
            const context = ev.scenarioContext.trim();
            if (!contextMap.has(context)) {
                contextMap.set(context, { englishScores: [], nativeScores: [], disparities: [], evaluations: [] });
            }
            
            const data = contextMap.get(context)!;
            const engScore = calculateOverallScore(ev.humanScores.english, ev.hiddenBuiltInKeys);
            const natScore = calculateOverallScore(ev.humanScores.native, ev.hiddenBuiltInKeys);

            data.englishScores.push(engScore);
            data.nativeScores.push(natScore);
            data.disparities.push(Math.abs(engScore - natScore));
            data.evaluations.push(ev);
        });

        const processedData = Array.from(contextMap.entries()).map(([context, data]) => {
            const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
            const count = data.englishScores.length;
            return {
                context,
                avgEnglish: count > 0 ? sum(data.englishScores) / count : 0,
                avgNative: count > 0 ? sum(data.nativeScores) / count : 0,
                avgDisparity: count > 0 ? sum(data.disparities) / count : 0,
                count,
                evaluations: data.evaluations
            };
        });
        
        const sortedByDisparity = [...processedData].sort((a,b) => b.avgDisparity - a.avgDisparity);

        processedData.sort((a, b) => {
            if (contextSortBy === 'english') return a.avgEnglish - b.avgEnglish;
            if (contextSortBy === 'native') return a.avgNative - b.avgNative;
            return b.avgDisparity - a.avgDisparity;
        });

        return {
            contextAnalysisData: processedData,
            top5DisparateContexts: new Set(sortedByDisparity.slice(0, 5).map(d => d.context))
        };
    }, [filteredEvaluations, contextSortBy]);
    
    const llmContextAnalysisData = useMemo(() => {
        const llmEvals = filteredEvaluations.filter(e => e.llmEvaluationStatus === 'completed' && e.llmScores);
        if (llmEvals.length === 0) return null;

        const contextMap = new Map<string, { englishScores: number[], nativeScores: number[], disparities: number[] }>();
        
        llmEvals.forEach(ev => {
            if (!ev.scenarioContext || !ev.llmScores) return;
            const context = ev.scenarioContext.trim();
            if (!contextMap.has(context)) {
                contextMap.set(context, { englishScores: [], nativeScores: [], disparities: [] });
            }
            
            const data = contextMap.get(context)!;
            const engScore = calculateOverallScore(ev.llmScores.english, ev.hiddenBuiltInKeys);
            const natScore = calculateOverallScore(ev.llmScores.native, ev.hiddenBuiltInKeys);

            data.englishScores.push(engScore);
            data.nativeScores.push(natScore);
            data.disparities.push(Math.abs(engScore - natScore));
        });

        const processedData = Array.from(contextMap.entries()).map(([context, data]) => {
            const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
            const count = data.englishScores.length;
            return {
                context,
                avgEnglish: count > 0 ? sum(data.englishScores) / count : 0,
                avgNative: count > 0 ? sum(data.nativeScores) / count : 0,
                avgDisparity: count > 0 ? sum(data.disparities) / count : 0,
                count
            };
        });
        return processedData
    }, [filteredEvaluations]);


    const heatmapData = useMemo(() => {
        if (filteredEvaluations.length === 0) return null;

        const dimensions = RUBRIC_DIMENSIONS.map(d => ({ 
            key: d.key, 
            label: getShortLabel(d.label),
            fullLabel: d.label,
        }));

        const dataByLang = new Map<string, { [key: string]: { sumDisparity: number, sumScoreA: number, sumScoreB: number, count: number } }>();

        filteredEvaluations.forEach(ev => {
            if (!ev.titleB || !ev.humanScores?.english || !ev.humanScores?.native) return;
            
            const langName = ev.titleB;

            if (!dataByLang.has(langName)) {
                dataByLang.set(langName, {});
            }

            const langData = dataByLang.get(langName)!;

            dimensions.forEach(dim => {
                if (!isDimensionVisibleForRecord(ev.hiddenBuiltInKeys, dim.key)) return;
                if (!langData[dim.key]) {
                    langData[dim.key] = { sumDisparity: 0, sumScoreA: 0, sumScoreB: 0, count: 0 };
                }
                const scoreA = getNumericScore(dim.key as any, ev.humanScores.english);
                const scoreB = getNumericScore(dim.key as any, ev.humanScores.native);
                const difference = Math.abs(scoreA - scoreB);

                langData[dim.key].sumDisparity += difference;
                langData[dim.key].sumScoreA += scoreA;
                langData[dim.key].sumScoreB += scoreB;
                langData[dim.key].count++;
            });
        });

        if (dataByLang.size === 0) return null;

        const heatmapRows = Array.from(dataByLang.entries()).map(([language, langData]) => ({
            language,
            disparities: Object.fromEntries(
                Object.entries(langData).map(([dimKey, { sumDisparity, sumScoreA, sumScoreB, count }]) => [
                    dimKey,
                    { value: sumDisparity / count, avgScoreA: sumScoreA / count, avgScoreB: sumScoreB / count, count }
                ])
            )
        }));
        
        heatmapRows.sort((a, b) => a.language.localeCompare(b.language));

        return {
            dimensions,
            rows: heatmapRows,
        };
    }, [filteredEvaluations]);


    const disparityChartData = useMemo(() => {
        if (filteredEvaluations.length === 0) return null;

        const llmEvaluable = filteredEvaluations.filter(e => e.llmEvaluationStatus === 'completed' && e.llmScores?.disparity);
        const llmEvalCount = llmEvaluable.length;

        const humanData = DISPARITY_CRITERIA.map(crit => {
            const counts = { yes: 0, no: 0, unsure: 0 };
            const applicableEvals = filteredEvaluations.filter(ev => isDisparityKeyVisibleForRecord(ev.hiddenBuiltInKeys, crit.key));
            applicableEvals.forEach(ev => {
                const value = ev.humanScores.disparity[crit.key as keyof typeof ev.humanScores.disparity];
                if (value === 'yes') counts.yes++; else if (value === 'no') counts.no++; else counts.unsure++;
            });
            return { ...crit, ...counts, total: applicableEvals.length };
        });

        const llmData = llmEvalCount > 0 ? DISPARITY_CRITERIA.map(crit => {
            const counts = { yes: 0, no: 0, unsure: 0 };
            const applicableEvals = llmEvaluable.filter(ev => isDisparityKeyVisibleForRecord(ev.hiddenBuiltInKeys, crit.key));
            applicableEvals.forEach(ev => {
                const value = ev.llmScores!.disparity[crit.key as keyof typeof ev.llmScores.disparity];
                if (value === 'yes') counts.yes++; else if (value === 'no') counts.no++; else counts.unsure++;
            });
            return { ...crit, ...counts, total: applicableEvals.length };
        }) : null;

        return { human: humanData, llm: llmData, count: filteredEvaluations.length, llmCount: llmEvalCount };
    }, [filteredEvaluations]);
    
    const agreementMetrics = useMemo(() => {
        const completedEvals = filteredEvaluations.filter(e => 
            e.llmEvaluationStatus === 'completed' && 
            e.llmScores &&
            e.llmScores.english &&
            e.llmScores.native &&
            e.llmScores.disparity
        );
        if (completedEvals.length === 0) return null;

        const agreementData = RUBRIC_DIMENSIONS.map(dim => {
            let agreements = 0;
            // A dimension hidden for a record was never asked of the human OR the LLM — both
            // sides carry the same placeholder default there, which would register as a
            // trivial, meaningless 100% "agreement". Scope both the count and the
            // denominator to only the evaluations that actually scored this dimension.
            const applicableEvals = completedEvals.filter(ev => isDimensionVisibleForRecord(ev.hiddenBuiltInKeys, dim.key));
            applicableEvals.forEach(ev => {
                const humanScoreA = getNumericScore(dim.key, ev.humanScores.english);
                const llmScoreA = getNumericScore(dim.key, ev.llmScores!.english);
                const humanScoreB = getNumericScore(dim.key, ev.humanScores.native);
                const llmScoreB = getNumericScore(dim.key, ev.llmScores!.native);

                if (dim.isSlider) {
                    if (Math.abs(humanScoreA - llmScoreA) <= 1) agreements++;
                    if (Math.abs(humanScoreB - llmScoreB) <= 1) agreements++;
                } else {
                    if (humanScoreA === llmScoreA) agreements++;
                    if (humanScoreB === llmScoreB) agreements++;
                }
            });
            const denominator = applicableEvals.length * 2;
            return { label: getShortLabel(dim.label), agreement: denominator > 0 ? (agreements / denominator) * 100 : 0 };
        });

        const disparityAgreementData = DISPARITY_CRITERIA.map(crit => {
            let agreements = 0;
            const applicableEvals = completedEvals.filter(ev => isDisparityKeyVisibleForRecord(ev.hiddenBuiltInKeys, crit.key));
            applicableEvals.forEach(ev => {
                const humanVal = ev.humanScores.disparity[crit.key as keyof typeof ev.humanScores.disparity];
                const llmDisparity = ev.llmScores?.disparity;
                const llmVal = llmDisparity ? llmDisparity[crit.key as keyof typeof llmDisparity] : undefined;
                if (humanVal === llmVal) agreements++;
            });
            return { label: crit.label, agreement: applicableEvals.length > 0 ? (agreements / applicableEvals.length) * 100 : 0 };
        });

        return {
            singleResponse: agreementData,
            disparity: disparityAgreementData,
            evalCount: completedEvals.length
        };
    }, [filteredEvaluations]);

    const modelComparisonData = useMemo(() => {
        const modelsInView = Array.from(new Set(filteredEvaluations.map(e => e.model)));
        if (modelsInView.length < 2) return null;

        const dataByModel = new Map<string, ReasoningEvaluationRecord[]>();
        modelsInView.forEach(model => dataByModel.set(model, []));

        filteredEvaluations.forEach(ev => {
            if (dataByModel.has(ev.model)) {
                dataByModel.get(ev.model)!.push(ev);
            }
        });

        const results: { 
            [modelId: string]: { 
                count: number; 
                avgScores: { [key: string]: number }; 
                disparityPercentages: { [key: string]: number };
                avgGenTimeA: number; avgGenTimeB: number;
                avgAnswerWordsA: number; avgAnswerWordsB: number;
                avgWpsA: number; avgWpsB: number;
            } 
        } = {};
        const dimensionKeys = RUBRIC_DIMENSIONS.map(d => d.key);
        const disparityKeys = DISPARITY_CRITERIA.map(c => c.key);

        dataByModel.forEach((evals, model) => {
            const count = evals.length;
            if (count === 0) return;

            // FIX: Explicitly type the records to prevent Object.fromEntries from inferring `unknown` values, which causes downstream errors.
            const scoreSums: Record<string, number> = Object.fromEntries(dimensionKeys.map(k => [k, 0]));
            // A dimension removed from some evaluations in this model's group must not use
            // the model's total record count as its denominator — track how many records
            // actually scored each dimension/criterion instead.
            const scoreCounts: Record<string, number> = Object.fromEntries(dimensionKeys.map(k => [k, 0]));
            const disparityCounts: Record<string, number> = Object.fromEntries(disparityKeys.map(k => [k, 0]));
            const disparityApplicableCounts: Record<string, number> = Object.fromEntries(disparityKeys.map(k => [k, 0]));
            const perfMetrics = { totalGenTimeA: 0, totalGenTimeB: 0, totalAnswerWordsA: 0, totalAnswerWordsB: 0 };

            evals.forEach(ev => {
                // Quality Scores
                dimensionKeys.forEach(key => {
                    if (!isDimensionVisibleForRecord(ev.hiddenBuiltInKeys, key as string)) return;
                    // FIX: Removed unnecessary `as any` type assertion. The `key` type is correct.
                    const scoreA = getNumericScore(key, ev.humanScores.english);
                    const scoreB = getNumericScore(key, ev.humanScores.native);
                    // FIX: Cast `key` to string to resolve index signature error.
                    scoreSums[key as string] += (scoreA + scoreB) / 2;
                    scoreCounts[key as string]++;
                });
                // Disparity Scores
                disparityKeys.forEach(key => {
                    if (!isDisparityKeyVisibleForRecord(ev.hiddenBuiltInKeys, key as string)) return;
                    disparityApplicableCounts[key as string]++;
                    // FIX: Removed unnecessary type assertion. `as const` on DISPARITY_CRITERIA ensures `key` is a valid key.
                    // FIX: Cast `key` to a valid key type to resolve index signature error.
                    if (ev.humanScores.disparity[key as keyof typeof ev.humanScores.disparity] === 'yes') {
                        disparityCounts[key as string]++;
                    }
                });
                // Performance Metrics
                perfMetrics.totalGenTimeA += (ev.generationTimeSecondsA ?? 0);
                perfMetrics.totalGenTimeB += (ev.generationTimeSecondsB ?? 0);
                perfMetrics.totalAnswerWordsA += (ev.answerWordCountA ?? 0);
                perfMetrics.totalAnswerWordsB += (ev.answerWordCountB ?? 0);
            });

            results[model] = {
                count,
                avgScores: Object.fromEntries(dimensionKeys.map(k => [k, scoreCounts[k as string] > 0 ? scoreSums[k as string] / scoreCounts[k as string] : 0])),
                disparityPercentages: Object.fromEntries(disparityKeys.map(k => [k, disparityApplicableCounts[k as string] > 0 ? (disparityCounts[k as string] / disparityApplicableCounts[k as string]) * 100 : 0])),
                avgGenTimeA: perfMetrics.totalGenTimeA / count,
                avgGenTimeB: perfMetrics.totalGenTimeB / count,
                avgAnswerWordsA: perfMetrics.totalAnswerWordsA / count,
                avgAnswerWordsB: perfMetrics.totalAnswerWordsB / count,
                avgWpsA: perfMetrics.totalGenTimeA > 0 ? perfMetrics.totalAnswerWordsA / perfMetrics.totalGenTimeA : 0,
                avgWpsB: perfMetrics.totalGenTimeB > 0 ? perfMetrics.totalAnswerWordsB / perfMetrics.totalGenTimeB : 0,
            };
        });

        const qualityScoresForChart = RUBRIC_DIMENSIONS.map(dim => ({
            label: getShortLabel(dim.label),
            // FIX: Cast `dim.key` to string to resolve index signature error.
            values: Object.fromEntries(modelsInView.map(modelId => [modelId, results[modelId]?.avgScores[dim.key as string] ?? 0]))
        }));

        const disparityScoresForChart = DISPARITY_CRITERIA.map(crit => ({
            label: crit.label.replace('Disparity in ', ''),
            // FIX: Cast `crit.key` to string to resolve index signature error.
            values: Object.fromEntries(modelsInView.map(modelId => [modelId, results[modelId]?.disparityPercentages[crit.key as string] ?? 0]))
        }));
        
        const performanceDataForChart = [
            {
                title: 'Avg. Generation Time (s)',
                unit: 's',
                data: modelsInView.map(modelId => ({
                    modelId,
                    modelName: AVAILABLE_MODELS.find(m => m.id === modelId)?.name || modelId,
                    valueA: results[modelId]?.avgGenTimeA ?? 0,
                    valueB: results[modelId]?.avgGenTimeB ?? 0,
                }))
            },
            {
                title: 'Avg. Answer Words',
                unit: '',
                data: modelsInView.map(modelId => ({
                    modelId,
                    modelName: AVAILABLE_MODELS.find(m => m.id === modelId)?.name || modelId,
                    valueA: results[modelId]?.avgAnswerWordsA ?? 0,
                    valueB: results[modelId]?.avgAnswerWordsB ?? 0,
                }))
            },
            {
                title: 'Avg. Words per Second',
                unit: ' w/s',
                data: modelsInView.map(modelId => ({
                    modelId,
                    modelName: AVAILABLE_MODELS.find(m => m.id === modelId)?.name || modelId,
                    valueA: results[modelId]?.avgWpsA ?? 0,
                    valueB: results[modelId]?.avgWpsB ?? 0,
                }))
            }
        ];
        
        return {
            qualityScores: qualityScoresForChart,
            disparityScores: disparityScoresForChart,
            performanceData: performanceDataForChart,
        };
    }, [filteredEvaluations]);

    // Custom criteria have no fixed identity across evaluations the way the built-in six
    // do (unique id per creation, no shared meaning). Two criteria only count as "the same"
    // if they share both a normalized label AND the exact same option set — same label with
    // different options shows up as a separate group rather than being silently merged into
    // a meaningless combined distribution. Legacy slider-type custom criteria (created before
    // custom criteria became write-your-own-options only) are excluded — they predate this
    // model entirely and can't be distributed the same way.
    const customCriteriaGroups = useMemo(() => {
        const groups = new Map<string, {
            label: string;
            options: string[];
            evalCount: number;
            englishCounts: Record<string, number>;
            nativeCounts: Record<string, number>;
            llmAgreementCount: number;
            llmAgreementTotal: number;
            disparityYes: number;
            disparityTotal: number;
        }>();

        filteredEvaluations.forEach(ev => {
            const englishCriteria = ev.humanScores?.english?.custom_criteria ?? [];
            const nativeCriteria = ev.humanScores?.native?.custom_criteria ?? [];
            const disparities = ev.humanScores?.disparity?.custom_disparities ?? [];
            const llmCompleted = ev.llmEvaluationStatus === 'completed' && ev.llmScores;
            const llmEnglish = llmCompleted ? (ev.llmScores!.english.custom_criteria ?? []) : [];
            const llmNative = llmCompleted ? (ev.llmScores!.native.custom_criteria ?? []) : [];

            englishCriteria.forEach(criterion => {
                if (criterion.type !== 'custom_options' || !criterion.options || criterion.options.length === 0) return;

                const signature = `${criterion.label.trim().toLowerCase()}::${criterion.options.slice().sort().join('|')}`;
                if (!groups.has(signature)) {
                    groups.set(signature, {
                        label: criterion.label,
                        options: criterion.options,
                        evalCount: 0,
                        englishCounts: {},
                        nativeCounts: {},
                        llmAgreementCount: 0,
                        llmAgreementTotal: 0,
                        disparityYes: 0,
                        disparityTotal: 0,
                    });
                }
                const group = groups.get(signature)!;
                group.evalCount++;

                const englishValue = String(criterion.value);
                group.englishCounts[englishValue] = (group.englishCounts[englishValue] ?? 0) + 1;

                const nativeCriterion = nativeCriteria.find(c => c.id === criterion.id);
                if (nativeCriterion) {
                    const nativeValue = String(nativeCriterion.value);
                    group.nativeCounts[nativeValue] = (group.nativeCounts[nativeValue] ?? 0) + 1;
                }

                const llmEnglishCriterion = llmEnglish.find(c => c.id === criterion.id);
                if (llmEnglishCriterion) {
                    group.llmAgreementTotal++;
                    if (llmEnglishCriterion.value === criterion.value) group.llmAgreementCount++;
                }
                const llmNativeCriterion = llmNative.find(c => c.id === criterion.id);
                if (llmNativeCriterion && nativeCriterion) {
                    group.llmAgreementTotal++;
                    if (llmNativeCriterion.value === nativeCriterion.value) group.llmAgreementCount++;
                }

                const disparity = disparities.find(d => d.id === criterion.id);
                if (disparity) {
                    group.disparityTotal++;
                    if (disparity.value === 'yes') group.disparityYes++;
                }
            });
        });

        return Array.from(groups.values()).sort((a, b) => b.evalCount - a.evalCount);
    }, [filteredEvaluations]);

    const mergedContextDataForPlots = useMemo(() => {
        if (!contextAnalysisData || !llmContextAnalysisData) {
            return null;
        }

        const createMergedList = (getValue: (item: any) => number) => 
            contextAnalysisData.map(h => {
                const l = llmContextAnalysisData.find(l => l.context === h.context);
                if (!l) return null;
                return { context: h.context, humanValue: getValue(h), llmValue: getValue(l) };
            }).filter((d): d is { context: string; humanValue: number; llmValue: number } => d !== null);
        
        return {
            disparity: createMergedList(item => item.avgDisparity),
            english: createMergedList(item => item.avgEnglish),
            native: createMergedList(item => item.avgNative),
        };

    }, [contextAnalysisData, llmContextAnalysisData]);


    const handleDisparityBarClick = (label: string, category: 'yes' | 'no' | 'unsure', source: 'human' | 'llm') => {
        const crit = DISPARITY_CRITERIA.find(c => c.label === label);
        if (!crit) return;
        const evalsToDrill = filteredEvaluations.filter(ev => {
            if (source === 'human') {
                return ev.humanScores.disparity[crit.key as keyof typeof ev.humanScores.disparity] === category;
            }
            if (source === 'llm' && ev.llmEvaluationStatus === 'completed' && ev.llmScores?.disparity) {
                return ev.llmScores.disparity[crit.key as keyof typeof ev.llmScores.disparity] === category;
            }
            return false;
        });
        setDrilldownData({ title: `${source.charAt(0).toUpperCase() + source.slice(1)} Disparity: "${label}" is "${category}"`, evaluations: evalsToDrill });
    };

    const handleRadarLabelClick = (dimensionKey: string, dimensionLabel: string) => {
        const lowScoringEvals = filteredEvaluations.filter(ev => {
            const scoreA = getNumericScore(dimensionKey as any, ev.humanScores.english);
            const scoreB = getNumericScore(dimensionKey as any, ev.humanScores.native);
            return scoreA < 3 || scoreB < 3;
        });
        setDrilldownData({ title: `Low Scores (< 3) for "${dimensionLabel}"`, evaluations: lowScoringEvals });
    };


    const exportDashboardAsPDF = async () => {
        const dashboardElement = document.getElementById('dashboard-content');
        if (!dashboardElement) return;

        try {
            // Create a loading state
            const originalText = 'Download Dashboard PDF';

            // Hide drilldown modal temporarily if open
            const modal = document.querySelector('[role="dialog"]');
            const modalDisplay = modal ? (modal as HTMLElement).style.display : '';
            if (modal) (modal as HTMLElement).style.display = 'none';

            // Create canvas from dashboard content
            const canvas = await html2canvas(dashboardElement, {
                scale: 2, // Higher quality
                useCORS: true,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0,
                width: dashboardElement.scrollWidth,
                height: dashboardElement.scrollHeight
            });

            // Restore modal if it was hidden
            if (modal && modalDisplay !== 'none') (modal as HTMLElement).style.display = modalDisplay;

            // Create PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');

            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;

            let position = 0;

            // Add first page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add additional pages if needed
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Save the PDF
            const fileName = `evaluation_dashboard_${selectedLanguagePair}_${selectedModel}_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    if (evaluations.length === 0) {
        return <div className="text-center py-10 bg-card border border-border rounded-xl shadow-sm"><p className="text-lg text-muted-foreground">Not enough data to generate a dashboard. Complete at least one evaluation.</p></div>;
    }

    return (
        <div className="space-y-8">
            {drilldownData && <DrilldownModal data={drilldownData} onClose={() => setDrilldownData(null)} />}

            <DashboardCard title="Dashboard Actions & Filters" subtitle="Select a language pair or model to refine the data across all charts.">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                        <label htmlFor="lang-pair-filter" className="text-sm font-medium text-foreground mb-1 block">Language Pair</label>
                        <select
                            id="lang-pair-filter"
                            value={selectedLanguagePair}
                            onChange={e => setSelectedLanguagePair(e.target.value)}
                            className="form-select w-full p-2 border rounded-md shadow-sm bg-background border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                        >
                            {languagePairs.map(pair => (
                                <option key={pair} value={pair}>{pair}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="model-filter" className="text-sm font-medium text-foreground mb-1 block">LLM Model</label>
                        <select
                            id="model-filter"
                            value={selectedModel}
                            onChange={e => setSelectedModel(e.target.value)}
                            className="form-select w-full p-2 border rounded-md shadow-sm bg-background border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                        >
                            {models.map(modelId => {
                                const modelDef = AVAILABLE_MODELS.find(m => m.id === modelId);
                                return (
                                    <option key={modelId} value={modelId}>
                                        {modelId === 'All' ? 'All Models' : modelDef?.name || modelId}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <div>
                        <button
                            onClick={exportDashboardAsPDF}
                            className="w-full bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all duration-200 text-sm flex items-center justify-center"
                            aria-label="Download dashboard as PDF"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                                <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zM8 8a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 018 8z" clipRule="evenodd" />
                            </svg>
                            Download Dashboard PDF
                        </button>
                    </div>
                </div>
            </DashboardCard>

            <div id="dashboard-content" className="space-y-8">

            {!metrics || !humanRadarChartData || !disparityChartData ? (
                 <div className="text-center py-10 bg-card border border-border rounded-xl shadow-sm">
                    <p className="text-lg text-muted-foreground">No evaluations found for the selected filters.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <DashboardCard title="Key Metrics" subtitle="A high-level overview of the filtered evaluation data.">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <StatCard label="Total Evaluations" value={metrics.totalEvaluations} icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path d="M10.75 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0V2.75z" /><path d="M3.5 10a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H4.25A.75.75 0 013.5 10z" /></svg>} />
                                <StatCard 
                                    label="Unique Base Scenarios" 
                                    value={metrics.uniqueScenarios} 
                                    icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg>}
                                    tooltip="Counts distinct scenarios from your source (e.g., unique rows in your CSV). A single scenario tested against multiple language pairs still counts as one base scenario."
                                />
                            </div>
                        </DashboardCard>
                         <DashboardCard title="Average Performance" subtitle="Comparing output metrics between English and native language responses.">
                             <div className="flex justify-end items-center gap-4 text-xs mb-4">
                                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500"></span><span>English</span></div>
                                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-violet-400"></span><span>Native Language</span></div>
                            </div>
                            <BarChart data={[
                                { label: 'Generation Time', valueA: metrics.avgTimeA, valueB: metrics.avgTimeB, unit: 's' },
                                { label: 'Answer Words', valueA: metrics.avgWordsA, valueB: metrics.avgWordsB, unit: '' },
                                { label: 'Words/Second', valueA: metrics.avgWordsPerSecondA, valueB: metrics.avgWordsPerSecondB, unit: '' },
                                { label: 'Reasoning Words', valueA: metrics.avgReasoningWordsA, valueB: metrics.avgReasoningWordsB, unit: '' },
                            ]} />
                        </DashboardCard>
                    </div>

                    <DashboardCard 
                        title="Harm Assessment Scores (Human vs. LLM)" 
                        subtitle={`Average scores across core rubric dimensions (1=Worst, 5=Best). Human scores based on ${filteredEvaluations.length} evals. LLM scores based on ${llmRadarChartData?.evalCount || 0} completed evals. Click a label for details.`}
                    >
                        <div className="flex items-center justify-center pt-2">
                           {(() => {
                                const combinedRadarData = {
                                    dimensionData: humanRadarChartData.dimensionData,
                                    datasets: [
                                        ...humanRadarChartData.datasets,
                                        ...(llmRadarChartData ? llmRadarChartData.datasets : [])
                                    ]
                                };
                                return <RadarChart data={combinedRadarData} onLabelClick={handleRadarLabelClick} />;
                           })()}
                        </div>
                    </DashboardCard>
                    
                    {heatmapData && (
                        <DashboardCard 
                            title="Multilingual Evaluation Disparity Heatmap (Human Scores)"
                            subtitle="This grid shows the average difference between English and native language scores (|Score_Eng - Score_Nat|), from 0 (no difference) to 4 (max difference). Bolder colors indicate greater disparity."
                        >
                            <div className="overflow-x-auto custom-scrollbar pb-2">
                                <div className="grid gap-1.5" style={{ gridTemplateColumns: `minmax(150px, 1fr) repeat(${heatmapData.dimensions.length}, minmax(100px, 1fr))` }}>
                                    {/* Header Row */}
                                    <div className="font-bold text-sm text-muted-foreground">Language</div>
                                    {heatmapData.dimensions.map(dim => (
                                        <div key={dim.key} className="font-bold text-sm text-center text-muted-foreground whitespace-normal" title={dim.fullLabel}>
                                            {dim.label}
                                        </div>
                                    ))}

                                    {/* Data Rows */}
                                    {heatmapData.rows.map(row => (
                                        <React.Fragment key={row.language}>
                                            <div className="font-semibold text-sm text-foreground pr-2 flex items-center">{row.language}</div>
                                            {heatmapData.dimensions.map(dim => {
                                                const cellData = row.disparities[dim.key];
                                                return cellData ? (
                                                    <MultiLanguageHeatmapCell
                                                        key={`${row.language}-${dim.key}`}
                                                        language={row.language}
                                                        dimensionLabel={dim.label}
                                                        value={cellData.value}
                                                        avgScoreA={cellData.avgScoreA}
                                                        avgScoreB={cellData.avgScoreB}
                                                        count={cellData.count}
                                                        maxValue={4}
                                                    />
                                                ) : (
                                                    <div key={`${row.language}-${dim.key}`} className="bg-muted rounded-md" title="No data"></div>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                <span>Low Disparity (0)</span>
                                <div className="w-32 h-4 rounded-md" style={{ background: 'linear-gradient(to right, hsl(50, 90%, 88%), hsl(25, 90%, 70%), hsl(0, 90%, 55%))' }}></div>
                                <span>High Disparity (4)</span>
                            </div>
                        </DashboardCard>
                    )}
                    
                    <DashboardCard 
                        title="Disparity Analysis (Human vs. LLM Scores)"
                        subtitle={`Comparing how humans and the LLM judge identified disparities. Click a bar segment to see the evaluations. LLM analysis is based on ${disparityChartData.llmCount} completed evaluation(s).`}
                    >
                        <StackedBarChart humanData={disparityChartData.human} llmData={disparityChartData.llm} onBarClick={handleDisparityBarClick} />
                    </DashboardCard>

                    {agreementMetrics && (
                         <DashboardCard 
                            title="Human vs. LLM Agreement Rate"
                            subtitle={`How often the LLM judge's scores align with human scores, based on ${agreementMetrics.evalCount} evaluation(s). Slider agreement is defined as scores within +/- 1 point.`}
                         >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div>
                                    <h4 className="font-semibold text-foreground mb-3">Single Response Scores</h4>
                                    <AgreementRateChart data={agreementMetrics.singleResponse} />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-foreground mb-3">Disparity Scores</h4>
                                    <AgreementRateChart data={agreementMetrics.disparity} />
                                </div>
                            </div>
                         </DashboardCard>
                    )}

                    {modelComparisonData && (
                        <DashboardCard title="Model Comparison" subtitle="Comparing performance and quality across all tested models in the current view.">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div>
                                    <h4 className="font-semibold text-foreground mb-4 text-center">Model Quality (Avg. Human Scores)</h4>
                                    <p className="text-xs text-muted-foreground text-center mb-4">Compares the average human score (1-5, higher is better) for each quality dimension across models.</p>
                                    <GroupedBarChart
                                        data={modelComparisonData.qualityScores}
                                        modelColors={MODEL_COLORS}
                                        maxValue={5}
                                    />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-foreground mb-4 text-center">Disparity Flags (% of 'Yes' responses)</h4>
                                     <p className="text-xs text-muted-foreground text-center mb-4">Shows the percentage of evaluations where humans flagged a disparity for each model (lower is better).</p>
                                    <GroupedBarChart
                                        data={modelComparisonData.disparityScores}
                                        modelColors={MODEL_COLORS}
                                        maxValue={100}
                                        unit="%"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <h4 className="font-semibold text-foreground text-center">Performance Metrics</h4>
                                    <p className="text-xs text-muted-foreground text-center -mt-2 mb-4">Compares average generation speed and output length, showing English vs. Native language results.</p>
                                    <div className="flex justify-center items-center gap-4 text-xs mb-4">
                                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500"></span><span>English (A)</span></div>
                                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-violet-400"></span><span>Native (B)</span></div>
                                    </div>
                                    <CompactPerformanceChart data={modelComparisonData.performanceData} />
                                </div>
                            </div>
                        </DashboardCard>
                    )}

                    {customCriteriaGroups.length > 0 && (
                        <DashboardCard
                            title="Custom Criteria"
                            subtitle="Evaluator-defined criteria, grouped by label and option set — two criteria only count as the same if both match exactly, so the same label used with different wording shows up as its own group rather than being merged."
                        >
                            <div className="space-y-8">
                                {customCriteriaGroups.map(group => {
                                    const agreementPercent = group.llmAgreementTotal > 0 ? (group.llmAgreementCount / group.llmAgreementTotal) * 100 : null;
                                    const disparityYesPercent = group.disparityTotal > 0 ? (group.disparityYes / group.disparityTotal) * 100 : 0;
                                    return (
                                        <div key={`${group.label}::${group.options.join('|')}`} className="pb-6 border-b border-border/60 last:border-b-0 last:pb-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="font-semibold text-foreground">{group.label}</h4>
                                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{group.evalCount} {group.evalCount === 1 ? 'evaluation' : 'evaluations'}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-3">Options: {group.options.join(', ')}</p>
                                            <div className="space-y-2">
                                                <OptionDistributionBar rowLabel="English" options={group.options} counts={group.englishCounts} />
                                                <OptionDistributionBar rowLabel="Native" options={group.options} counts={group.nativeCounts} />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                                <div>
                                                    <p className="text-xs font-medium text-foreground mb-1">Human vs. LLM Agreement</p>
                                                    {agreementPercent !== null ? (
                                                        <AgreementRateChart data={[{ label: 'Exact match', agreement: agreementPercent }]} />
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground italic">No completed LLM judge results yet for this criterion.</p>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-foreground mb-1">Disparity Flagged (human)</p>
                                                    {group.disparityTotal > 0 ? (
                                                        <p className="text-sm text-foreground">{group.disparityYes} of {group.disparityTotal} evaluations ({disparityYesPercent.toFixed(0)}%) flagged a disparity.</p>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground italic">No disparity data.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </DashboardCard>
                    )}

                </>
            )}
            </div>
        </div>
    );
};

export default ReasoningDashboard;
