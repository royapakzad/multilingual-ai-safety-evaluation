import React, { useEffect, useState } from 'react';
import { fetchGatewayWorkspace } from '../services/llmService';

/**
 * Warns when the Otari gateway (api/llm.ts) is unreachable or has no Otari key configured.
 * Provider keys no longer exist in the browser, so there is nothing to check client-side —
 * the server reports whether it can route this user's calls.
 */
const ApiKeyWarning: React.FC = () => {
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    fetchGatewayWorkspace()
      .then(ws => {
        if (!ws.configured) {
          setProblem('No Otari key is configured on the server. Set OTARI_KEY_DEFAULT (and optional OTARI_KEY_<ORG> keys) in the Vercel project environment, then redeploy.');
        }
      })
      .catch(err => setProblem(err instanceof Error ? err.message : String(err)));
  }, []);

  if (!problem) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-300 text-amber-900 px-4 py-3 text-sm" role="alert">
      <strong className="font-semibold">LLM gateway unavailable:</strong> {problem}
    </div>
  );
};

export default ApiKeyWarning;
