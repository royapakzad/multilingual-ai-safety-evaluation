import React, { useState } from 'react';
import { submitAccessRequest } from '../services/accessRequestService';

const RequestAccess: React.FC = () => {
  const [email, setEmail] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await submitAccessRequest(email, purpose);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-4" role="status">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-12 h-12 text-primary mx-auto mb-4">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <p className="text-foreground font-medium">Request received.</p>
        <p className="text-muted-foreground text-sm mt-2">
          Thanks for your interest. Requests are reviewed by hand, so please allow a couple of days.
          If approved, we'll email you a temporary password at <span className="font-medium">{email}</span> — you can change it once you sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="request_email" className="sr-only">Email</label>
        <input
          id="request_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          className="form-input w-full px-4 py-3 border border-input bg-background text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all shadow-sm hover:border-accent"
          required
          autoFocus
          aria-label="Email address"
        />
      </div>
      <div>
        <label htmlFor="request_purpose" className="sr-only">Purpose of use</label>
        <textarea
          id="request_purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="What would you like to use this tool for? (a sentence or two is fine)"
          rows={3}
          maxLength={500}
          className="form-input w-full px-4 py-3 border border-input bg-background text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all shadow-sm hover:border-accent resize-none"
          required
          aria-label="Purpose of use"
        />
      </div>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary hover:opacity-90 text-primary-foreground font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all duration-300 ease-in-out disabled:opacity-60"
        aria-label="Submit access request"
      >
        {isSubmitting ? 'Submitting...' : 'Request Access'}
      </button>
    </form>
  );
};

export default RequestAccess;
