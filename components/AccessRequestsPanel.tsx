import React, { useEffect, useState } from 'react';
import {
  AccessRequest,
  listPendingAccessRequests,
  approveAccessRequest,
  rejectAccessRequest
} from '../services/accessRequestService';
import LoadingSpinner from './LoadingSpinner';

interface AccessRequestsPanelProps {
  onClose: () => void;
}

const AccessRequestsPanel: React.FC<AccessRequestsPanelProps> = ({ onClose }) => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approvedInfo, setApprovedInfo] = useState<{ email: string; tempPassword: string } | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const pending = await listPendingAccessRequests();
      setRequests(pending);
    } catch (err: any) {
      setError(err.message || 'Failed to load access requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (request: AccessRequest) => {
    setBusyId(request.id);
    setError(null);
    try {
      const tempPassword = await approveAccessRequest(request);
      setApprovedInfo({ email: request.email, tempPassword });
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err: any) {
      setError(err.message || 'Failed to approve request.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (request: AccessRequest) => {
    setBusyId(request.id);
    setError(null);
    try {
      await rejectAccessRequest(request.id);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err: any) {
      setError(err.message || 'Failed to reject request.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="access-requests-title">
      <div className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 id="access-requests-title" className="text-xl font-bold text-foreground">Pending Access Requests</h2>
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

        {approvedInfo && (
          <div className="mb-6 p-4 bg-secondary text-secondary-foreground rounded-lg text-sm">
            <p className="font-medium">Account created for {approvedInfo.email}.</p>
            <p className="mt-1">
              Temp password: <span className="font-mono font-bold">{approvedInfo.tempPassword}</span>
            </p>
            <p className="mt-1 text-muted-foreground">
              An email with this password was sent automatically if EmailJS is configured. If not, copy it and send it to them yourself.
            </p>
            <button onClick={() => setApprovedInfo(null)} className="mt-2 text-primary hover:underline text-xs">Dismiss</button>
          </div>
        )}

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        {isLoading ? (
          <div className="py-8"><LoadingSpinner /></div>
        ) : requests.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No pending requests.</p>
        ) : (
          <ul className="space-y-4">
            {requests.map((request) => (
              <li key={request.id} className="border border-border rounded-lg p-4">
                <p className="font-medium text-foreground">{request.email}</p>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{request.purpose}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleApprove(request)}
                    disabled={busyId === request.id}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(request)}
                    disabled={busyId === request.id}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-muted disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AccessRequestsPanel;
