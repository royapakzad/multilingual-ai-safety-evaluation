import React, { useState } from 'react';
import { changePassword } from '../services/authService';

interface ChangePasswordProps {
  onClose: () => void;
}

const ChangePassword: React.FC<ChangePasswordProps> = ({ onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
      <div className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-sm p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 id="change-password-title" className="text-xl font-bold text-foreground">Change Password</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 10-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {success ? (
          <div>
            <p className="text-sm text-foreground">Your password has been changed.</p>
            <button
              onClick={onClose}
              className="w-full mt-4 bg-primary text-primary-foreground font-semibold py-2.5 px-4 rounded-lg hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new_password" className="sr-only">New password</label>
              <input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="form-input w-full px-4 py-3 border border-input bg-background text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all"
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="confirm_password" className="sr-only">Confirm new password</label>
              <input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="form-input w-full px-4 py-3 border border-input bg-background text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary text-primary-foreground font-semibold py-2.5 px-4 rounded-lg hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Save Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePassword;
