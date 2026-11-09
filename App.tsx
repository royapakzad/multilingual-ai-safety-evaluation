

import React, { useState, useEffect } from 'react';
import { User, EvaluationMode } from './types';
import { THEME_KEY, APP_TITLE } from './constants';
import { signIn, signOut, onAuthStateChange, AuthState } from './services/authService';
import Login from './components/PasswordGate';
import Header from './components/Header';
import ApiKeyWarning from './components/ApiKeyWarning';
import ReasoningLab from './components/ReasoningLab';
import EvaluationLobby from './components/EvaluationLobby';
import MultiTurnLab from './components/MultiTurnLab';
import ResearchLab from './components/ResearchLab';
import ChangePassword from './components/ChangePassword';
import AccessRequestsPanel from './components/AccessRequestsPanel';
import PartnerOrgsPanel from './components/PartnerOrgsPanel';

const App: React.FC = () => {
  // Core App State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  // The open evaluation: its name and the mode it was created in. null = the evaluations list.
  const [evaluation, setEvaluation] = useState<{ name: string; mode: EvaluationMode } | null>(null);
  const leaveEvaluation = () => setEvaluation(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAccessRequests, setShowAccessRequests] = useState(false);
  const [showPartnerOrgs, setShowPartnerOrgs] = useState(false);

  useEffect(() => {
    // Force light mode
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add('light');
    try {
      localStorage.setItem(THEME_KEY, 'light');
    } catch (e) {
      console.warn('Failed to save theme to localStorage:', e);
    }
  }, []);

  // Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChange((authState: AuthState) => {
      setCurrentUser(authState.user);
      setAuthLoading(authState.loading);
    });

    return unsubscribe; // Clean up listener on component unmount
  }, []);

  const handleLoginSubmit = async (email: string, password: string) => {
    setLoginError(null);
    try {
      await signIn(email.toLowerCase().trim(), password);
      // User state will be updated automatically via onAuthStateChange
    } catch (error: any) {
      setLoginError(error.message || "Invalid credentials. Please check your email and password.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // User state will be updated automatically via onAuthStateChange
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return <Login onLoginSubmit={handleLoginSubmit} loginError={loginError} />;

  // The lab's name is the home link: from inside an evaluation it returns to the picker;
  // on the picker itself it just scrolls back to the top.
  const goHome = () => {
    if (evaluation) setEvaluation(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <ApiKeyWarning />
      <Header
        user={currentUser}
        onHome={goHome}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePassword(true)}
        onOpenAccessRequests={() => setShowAccessRequests(true)}
        onOpenPartnerOrgs={() => setShowPartnerOrgs(true)}
      />

      {evaluation ? (
        <main className="flex-grow w-full max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8" aria-live="polite">
          {/* Each mode has its own lab, so features of one mode never affect another. */}
          {evaluation.mode === 'multi-turn' ? (
            <MultiTurnLab currentUser={currentUser} evaluationName={evaluation.name} onLeaveEvaluation={leaveEvaluation} />
          ) : evaluation.mode === 'agentic' ? (
            <ResearchLab currentUser={currentUser} evaluationName={evaluation.name} onLeaveEvaluation={leaveEvaluation} />
          ) : (
            <ReasoningLab currentUser={currentUser} evaluationName={evaluation.name} onLeaveEvaluation={leaveEvaluation} />
          )}
        </main>
      ) : (
        <EvaluationLobby currentUser={currentUser} onEnter={(name, mode) => setEvaluation({ name, mode })} />
      )}

      <footer className="py-6 border-t border-border text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row gap-1 sm:justify-between">
          <span>{APP_TITLE} &copy; {new Date().getFullYear()}</span>
          <span>For research and educational purposes.</span>
        </div>
      </footer>

      {showChangePassword && <ChangePassword onClose={() => setShowChangePassword(false)} />}
      {showAccessRequests && <AccessRequestsPanel onClose={() => setShowAccessRequests(false)} />}
      {showPartnerOrgs && <PartnerOrgsPanel onClose={() => setShowPartnerOrgs(false)} />}
    </div>
  );
};

export default App;
