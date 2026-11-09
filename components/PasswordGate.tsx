
import React, { useState } from 'react';
import BrandMark from './BrandMark';
import RequestAccess from './RequestAccess';
import DonateSection from './DonateSection';

interface LoginProps {
  onLoginSubmit: (email: string, password: string) => void;
  loginError: string | null;
}

// NOTE: This component is now a full login screen. Consider renaming the file to Login.tsx.
const Login: React.FC<LoginProps> = ({ onLoginSubmit, loginError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSubmit(email, password);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="bg-card text-card-foreground p-8 md:p-12 rounded-2xl border border-border shadow-sm w-full max-w-md">
        <div className="text-center mb-8">
          <BrandMark size="hero" />
          <p className="text-muted-foreground mt-3 text-[15px]">
            {isRequestingAccess ? 'Tell us a bit about your intended use.' : 'Enter your credentials to continue.'}
          </p>
        </div>

        {isRequestingAccess ? (
          <RequestAccess />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email_input" className="sr-only">Email</label>
              <input
                id="email_input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="form-input w-full px-4 py-3 border border-input bg-background text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all shadow-sm hover:border-accent"
                required
                autoFocus
                aria-label="Email address input"
              />
            </div>
            <div>
              <label htmlFor="password_input" className="sr-only">Password</label>
              <input
                id="password_input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="form-input w-full px-4 py-3 border border-input bg-background text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all shadow-sm hover:border-accent"
                required
                aria-label="Password Input"
              />
            </div>
            {loginError && (
              <p className="text-sm text-destructive text-center">{loginError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-primary hover:opacity-90 text-primary-foreground font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all duration-300 ease-in-out transform hover:-translate-y-px active:translate-y-0 active:shadow-md"
              aria-label="Submit credentials and enter lab"
            >
              Sign In
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setIsRequestingAccess(!isRequestingAccess)}
          className="w-full text-primary hover:underline text-sm mt-6"
        >
          {isRequestingAccess ? 'Already have an account? Sign in' : 'Need an account? Request access'}
        </button>
      </div>
      {!isRequestingAccess && (
        <p className="text-center text-xs text-muted-foreground mt-6 max-w-sm">
          New accounts are created by an administrator after a short review. First-time users should request access above.
        </p>
      )}
      <DonateSection />
    </div>
  );
};

export default Login;
