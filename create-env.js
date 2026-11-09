// create-env.js
const fs = require('fs');

// Generates env.js — the ONLY environment values bundled into the browser app.
//
// IMPORTANT: never add secrets here. Anything written to env.js ships in the public JavaScript
// bundle and can be read by anyone who opens the site. LLM access keys (Otari) are read
// server-side only, by the /api/llm gateway (api/llm.ts), from these Vercel env vars:
//   OTARI_KEY_DEFAULT, OTARI_KEY_<ORG_ID>, OTARI_BASE_URL (optional)
const envContent = `
// This file is auto-generated during the build process and should not be committed.
// It intentionally contains no secrets — see create-env.js.

export const LLM_GATEWAY = "otari";
`;

try {
  fs.writeFileSync('./env.js', envContent);
  console.log('Successfully created env.js (no secrets; LLM keys stay server-side).');
} catch (err) {
  console.error('Failed to create env.js:', err);
  process.exit(1);
}
