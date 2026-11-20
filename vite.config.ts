import path from 'path';
import { defineConfig } from 'vite';

// No secrets are injected into the client bundle. All LLM keys live server-side and are used
// only by the /api/llm gateway (api/llm.ts) — see constants/api.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
