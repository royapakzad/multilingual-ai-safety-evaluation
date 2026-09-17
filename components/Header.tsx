
import React from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import { User } from '../types';

interface HeaderProps {
  title: string;
  user: User | null;
  currentTheme: 'light' | 'dark';
  onThemeToggle: () => void;
  onLogout: () => void;
  showBack?: boolean;
  onBack?: () => void;
  onChangePassword?: () => void;
  onOpenAccessRequests?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, user, currentTheme, onThemeToggle, onLogout, showBack, onBack, onChangePassword, onOpenAccessRequests }) => {
  return (
    <header className="bg-card text-card-foreground shadow-md sticky top-0 z-50 border-b border-border">
      <div className="container mx-auto px-4 md:px-6 py-3.5 flex justify-between items-center">
        <div className="flex items-center space-x-3">
           {showBack && (
             <button 
                onClick={onBack}
                className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Go back to lab selection"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
             </button>
           )}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-8 h-8 text-primary hidden sm:block">
             <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" opacity="0.3"/>
             <path fill="currentColor" d="M12 4c-4.41 0-8 3.59-8 8s3.59 8 8 8 8-3.59 8 8-3.59-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm1-11h-2v4h2V7zm0 6h-2v2h2v-2z"/>
           </svg>
          <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          {user && (
            <div className="hidden sm:flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full text-sm font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 opacity-90">
                  <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                </svg>
                <span className="truncate max-w-[150px] md:max-w-xs">{user.email}</span>
                <span className="text-xs opacity-80">({user.role})</span>
              </div>
              {user.role === 'admin' && onOpenAccessRequests && (
                <button
                  onClick={onOpenAccessRequests}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Access Requests
                </button>
              )}
              {onChangePassword && (
                <button
                  onClick={onChangePassword}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Change Password
                </button>
              )}
              <button
                onClick={onLogout}
                className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Logout"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M16.78 9.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L14.94 11H9.25a.75.75 0 010-1.5h5.69l-3.47-3.47a.75.75 0 011.06-1.06l4.25 4.25z" clipRule="evenodd" />
                  </svg>
              </button>
            </div>
          )}
          <ThemeSwitcher currentTheme={currentTheme} onToggle={onThemeToggle} />
        </div>
      </div>
    </header>
  );
};

export default Header;
