import React from 'react';

/**
 * The lab's mark: two overlapping speech bubbles, the same question asked in two languages
 * and compared side by side. Drawn with currentColor so it follows the text colour.
 */
export const BrandGlyph: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
    <path
      d="M7.5 4h11A2.5 2.5 0 0 1 21 6.5v7a2.5 2.5 0 0 1-2.5 2.5H13l-4.2 3.4c-.5.4-1.3 0-1.3-.6V16A2.5 2.5 0 0 1 5 13.5v-7A2.5 2.5 0 0 1 7.5 4Z"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
    />
    {/* A surface-coloured ring keeps the two bubbles legible where they overlap. */}
    <path
      d="M13.5 12h11a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5v3.4c0 .6-.8 1-1.3.6L19 24h-5.5a2.5 2.5 0 0 1-2.5-2.5v-7a2.5 2.5 0 0 1 2.5-2.5Z"
      fill="currentColor" stroke="var(--color-card, #fff)" strokeWidth="2" strokeLinejoin="round" paintOrder="stroke"
    />
  </svg>
);

interface BrandMarkProps {
  onClick?: () => void;
  /** Larger, stacked lockup for the sign-in screen. */
  size?: 'nav' | 'hero';
}

/** Wordmark + glyph. Rendered as a home link when onClick is given. */
const BrandMark: React.FC<BrandMarkProps> = ({ onClick, size = 'nav' }) => {
  if (size === 'hero') {
    return (
      <div className="flex flex-col items-center text-center">
        <BrandGlyph className="w-11 h-11 text-primary mb-4" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Multilingual LLM</p>
        <h1 className="mt-1 text-2xl sm:text-[28px] leading-tight font-semibold tracking-tight text-foreground">
          Safety Evaluation Lab
        </h1>
      </div>
    );
  }

  const content = (
    <>
      <BrandGlyph className="w-7 h-7 text-primary shrink-0" />
      <span className="flex flex-col leading-none text-left">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Multilingual LLM</span>
        <span className="mt-1 text-[15px] font-semibold tracking-tight text-foreground">Safety Evaluation Lab</span>
      </span>
    </>
  );

  if (!onClick) return <div className="flex items-center gap-2.5">{content}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Back to your evaluations"
      aria-label="Multilingual LLM Safety Evaluation Lab, back to your evaluations"
      className="group flex items-center gap-2.5 -mx-2 px-2 py-1 rounded-lg transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </button>
  );
};

export default BrandMark;
