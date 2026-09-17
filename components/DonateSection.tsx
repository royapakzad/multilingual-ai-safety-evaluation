import React from 'react';

const PAYPAL_DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=R6LB4TPMFFXGE';

const DonateSection: React.FC = () => {
  return (
    <div className="text-center text-xs text-muted-foreground mt-8 max-w-sm space-y-3">
      <p>
        This is a free,{' '}
        <a
          href="https://github.com/royapakzad/ai-safety-evaluation-lab"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          open-source research tool
        </a>
        , built and hosted by{' '}
        <a
          href="https://taraazresearch.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Taraaz
        </a>
        , a 501(c)(3) nonprofit (EIN 85-4250521).
      </p>
      <a
        href={PAYPAL_DONATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-4 py-2 rounded-full border border-input text-foreground hover:bg-muted transition-colors font-medium"
        aria-label="Donate to help cover API and maintenance costs"
      >
        Donate
      </a>
      <p>Donations only go toward API usage and maintenance costs — not compensation.</p>
    </div>
  );
};

export default DonateSection;
