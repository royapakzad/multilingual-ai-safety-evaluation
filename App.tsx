

import React, { useState, useEffect } from 'react';
import { User, Theme } from './types';
import {
    USER_KEY,
    THEME_KEY, APP_TITLE
} from './constants';
import * as config from './env.js'; // Import API keys from env.js
import { signIn, signOut, onAuthStateChange, AuthState } from './services/authService';
import Login from './components/PasswordGate';
import Header from './components/Header';
import ApiKeyWarning from './components/ApiKeyWarning';
import ReasoningLab from './components/ReasoningLab';

const App: React.FC = () => {
  // Core App State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<Theme>('light');
  const [isAnyApiKeyMissingOrPlaceholder, setIsAnyApiKeyMissingOrPlaceholder] = useState<boolean>(false);

  // Check for API Keys on mount
  useEffect(() => {
    const c = config as any;
    const geminiKeyMissing = !c.API_KEY || c.API_KEY === "YOUR_GOOGLE_GEMINI_API_KEY_HERE" || c.API_KEY === "";
    const openaiKeyMissing = !c.OPENAI_API_KEY || c.OPENAI_API_KEY === "YOUR_OPENAI_API_KEY_HERE" || c.OPENAI_API_KEY === "";
    const mistralKeyMissing = !c.MISTRAL_API_KEY || c.MISTRAL_API_KEY === "YOUR_MISTRAL_API_KEY_HERE" || c.MISTRAL_API_KEY === "";
    const openrouterKeyMissing = !c.OPENROUTER_API_KEY || c.OPENROUTER_API_KEY === "YOUR_OPENROUTER_API_KEY_HERE" || c.OPENROUTER_API_KEY === "";

    // Warn if Gemini is missing (needed for translation + LLM-as-judge)
    // or if no model provider is configured at all
    const noModelProvider = openaiKeyMissing && mistralKeyMissing && openrouterKeyMissing;
    if (geminiKeyMissing || noModelProvider) {
      setIsAnyApiKeyMissingOrPlaceholder(true);
      console.warn("One or more required API keys are missing in env.js. Some features may be unavailable.");
    } else {
      setIsAnyApiKeyMissingOrPlaceholder(false);
    }
  }, []);
  
  // Theme management - Force light mode only
  useEffect(() => {
    // Always use light theme
    setTheme('light');
  }, []);

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

  // Theme toggle disabled - always light mode
  const toggleTheme = () => {
    // Do nothing - theme is locked to light mode
  };

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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {isAnyApiKeyMissingOrPlaceholder && <ApiKeyWarning />}
      <Header 
        title={APP_TITLE} 
        user={currentUser} 
        currentTheme={theme} 
        onThemeToggle={toggleTheme} 
        onLogout={handleLogout}
        showBack={false}
      />
      
      <main className="flex-grow container mx-auto p-4 sm:p-6 md:p-8" aria-live="polite">
        <ReasoningLab currentUser={currentUser} />
      </main>

      <footer className="text-center py-6 border-t border-border text-xs text-muted-foreground">
        LLM Evaluation Labs &copy; {new Date().getFullYear()}. For research and educational purposes.
      </footer>
    </div>
  );
};

export default App;
