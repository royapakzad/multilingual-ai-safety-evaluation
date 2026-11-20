import React, { useEffect, useMemo, useState } from 'react';
import { OrgMembership, listOrgMemberships, setOrgMembership, removeOrgMembership, normalizeOrgId, otariEnvVarForOrg } from '../services/orgService';
import LoadingSpinner from './LoadingSpinner';

interface PartnerOrgsPanelProps {
  onClose: () => void;
}

/**
 * Admin-only: assign evaluators to partner organizations. Each organization's model calls are
 * billed to its own Otari workspace key (OTARI_KEY_<ORG_ID> in Vercel), with its own budget and
 * model allow-list. Evaluators without an org use OTARI_KEY_DEFAULT.
 */
const PartnerOrgsPanel: React.FC<PartnerOrgsPanelProps> = ({ onClose }) => {
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setMemberships(await listOrgMemberships());
    } catch (err: any) {
      setError(`${err.message || 'Failed to load partner organizations.'} (Have the orgMemberships Firestore rules from FIREBASE_SETUP.md been published?)`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const byOrg = useMemo(() => {
    const groups = new Map<string, { orgName: string; members: OrgMembership[] }>();
    memberships.forEach(m => {
      const g = groups.get(m.orgId) ?? { orgName: m.orgName, members: [] };
      g.members.push(m);
      groups.set(m.orgId, g);
    });
    return Array.from(groups.entries());
  }, [memberships]);

  const existingOrgNames = useMemo(() => Array.from(new Set(memberships.map(m => m.orgName))), [memberships]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await setOrgMembership(email, orgName);
      setMemberships(prev => [...prev.filter(m => m.email !== saved.email), saved]);
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to save.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (m: OrgMembership) => {
    if (!window.confirm(`Remove ${m.email} from ${m.orgName}? Their calls will use the lab's default Otari key.`)) return;
    setBusy(true);
    try {
      await removeOrgMembership(m.email);
      setMemberships(prev => prev.filter(x => x.email !== m.email));
    } catch (err: any) {
      setError(err.message || 'Failed to remove.');
    } finally {
      setBusy(false);
    }
  };

  const previewOrgId = normalizeOrgId(orgName);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="partner-orgs-title">
      <div className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 md:p-8">
        <div className="flex justify-between items-center mb-2">
          <h2 id="partner-orgs-title" className="text-xl font-bold text-foreground">Partner Organizations</h2>
          <button onClick={onClose} className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 10-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Each organization's model calls are billed to its own Otari workspace — with its own budget, model allow-list and usage report.
          Create the workspace and key in the Otari dashboard, add the key to Vercel as the environment variable shown below, then assign evaluators here.
          Evaluators with no organization use <code>OTARI_KEY_DEFAULT</code>.
        </p>

        <form onSubmit={handleAssign} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end mb-2">
          <div>
            <label htmlFor="org-email" className="block text-xs font-medium text-foreground mb-1">Evaluator email</label>
            <input id="org-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="evaluator@partner.org"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label htmlFor="org-name" className="block text-xs font-medium text-foreground mb-1">Organization</label>
            <input id="org-name" list="org-name-options" required value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. UNESCO"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            <datalist id="org-name-options">{existingOrgNames.map(n => <option key={n} value={n} />)}</datalist>
          </div>
          <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60">Assign</button>
        </form>
        {previewOrgId && (
          <p className="text-xs text-muted-foreground mb-6">Vercel env var for this org's Otari key: <code className="font-mono">{otariEnvVarForOrg(previewOrgId)}</code></p>
        )}

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        {isLoading ? (
          <div className="py-8"><LoadingSpinner /></div>
        ) : byOrg.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No partner organizations yet — everyone uses the lab's default Otari key.</p>
        ) : (
          <div className="space-y-4">
            {byOrg.map(([orgId, group]) => (
              <div key={orgId} className="border border-border rounded-lg p-4">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-foreground">{group.orgName}</h3>
                  <code className="text-xs font-mono text-muted-foreground">{otariEnvVarForOrg(orgId)}</code>
                </div>
                <ul className="divide-y divide-border">
                  {group.members.map(m => (
                    <li key={m.email} className="flex items-center justify-between py-1.5 text-sm">
                      <span>{m.email}</span>
                      <button onClick={() => handleRemove(m)} disabled={busy} className="text-xs text-destructive hover:underline disabled:opacity-60">Remove</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerOrgsPanel;
