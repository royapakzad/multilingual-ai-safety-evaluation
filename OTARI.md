# Otari integration — Multilingual AI Safety Evaluation Lab

The lab sends **every** LLM call through [Otari](https://otari.ai), Mozilla AI's open-source AI gateway. That covers all three roles:

| Role | What it does | Who picks the model |
|---|---|---|
| **Model under evaluation** | Answers the English prompt and the translated prompt | Evaluator, from any model their org's Otari key allows |
| **Translation model** | Translates the English prompt into the target language (or *Manual* for human translation) | Evaluator |
| **LLM-as-a-judge** | Scores both answers with the same human-rights rubric the human used | Evaluator. Not tied to one vendor; open-weight or proprietary |

Open-weight models (DeepSeek, GLM, Qwen, Llama, Apertus, Mistral Small …) and proprietary ones (OpenAI, Anthropic, Google Gemini) share one endpoint, one key and one model picker, labelled **Open weights** / **Proprietary**.

---

## Architecture

```
Browser (React app on Vercel)
   │  Firebase login token only. No API keys.
   ▼
/api/llm   (Vercel serverless function, api/llm.ts)
   1. verifies the Firebase login token
   2. looks up the user's partner org (Firestore orgMemberships, admin-written only)
   3. picks that org's Otari key from a server env var  →  OTARI_KEY_UNESCO, OTARI_KEY_DEFAULT …
   ▼
Otari  (api.otari.ai)  →  budgets · model allow-list · fallback · cost/usage logging
   ▼
OpenAI · Anthropic · Gemini · Fireworks · Together · Mistral · Hugging Face …
```

### Partner organizations = Otari workspaces

```
Lab's Otari account
├── Workspace: UNESCO       → key OTARI_KEY_UNESCO      (own budget, own model allow-list)
├── Workspace: Regulator X  → key OTARI_KEY_REGULATOR_X
├── Workspace: NGO Y        → key OTARI_KEY_NGO_Y
└── Workspace: Lab default  → key OTARI_KEY_DEFAULT     (everyone not assigned to an org)
```

Partner organizations **don't need an Otari account**. The lab admin creates their workspace and key, sets the budget, and assigns evaluators under **Partner Orgs** in the app's header. A partner that wants to pay its own way can later bring its own Otari key, which is added the same way.

---

## Setup

### 1. Otari (otari.ai dashboard)
1. **Organization → Providers → Add provider key**: add your own keys (OpenAI, Anthropic, Mistral, Fireworks, Together…). Your own keys are billed by the provider with no Otari routing fee. Models without your own key run on Otari-managed keys and draw from the org balance (**Organization → Billing**).
2. **Organization → Workspaces → Create workspace**: one per partner org, plus one "Lab default".
3. Open each workspace → **API Keys → Create Key** (copy the `otk_…` token; it's shown once). Use **Advanced** to restrict that key to specific models. The app's model pickers show exactly what each key allows.
4. **Organization → Spend & Budgets → Add budget** (amount + Daily/Weekly/Monthly), then **Add ceiling** with *Capping* = that partner's workspace. A budget does nothing until a ceiling is attached. When it's used up, Otari blocks that workspace's requests until the next period. Partners don't need to be members.

### 2. Vercel → Project → Settings → Environment Variables
| Variable | Value |
|---|---|
| `OTARI_KEY_DEFAULT` | key for the "Lab default" workspace (**required**) |
| `OTARI_KEY_<ORG_ID>` | one per partner, e.g. `OTARI_KEY_UNESCO`. The Partner Orgs panel shows the exact name |
| `OTARI_BASE_URL` | optional. Default `https://api.otari.ai/api/v1`; EU: `https://eu.api.otari.ai/api/v1` |

You can **delete** the old `API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY` and `HUGGINGFACE_API_KEY` variables. They were compiled into the public JavaScript bundle, so rotate them at each provider as well (see Security below).

### 3. Firestore rules
Publish the updated rules in `FIREBASE_SETUP.md`. They add `orgMemberships`, which only the admin can write and where each user can read only their own entry.

### 4. Local development
`/api/llm` is a Vercel function, so run the app with `npx vercel dev` (after `npx vercel link` and `npx vercel env pull`) instead of `npm run dev`.

### 5. Check model IDs
The suggested models in `constants/models.ts` use Otari's formats (`provider:model` or catalog `vendor/model`). Compare them with your Otari model catalog. A suggested model only appears in the pickers when your key's model list confirms it.

---

## For the write-up / video: how Otari makes the lab better

### 🔐 Privacy & security
- **No API keys in the browser.** Before Otari, the lab's provider keys were compiled into the website's public JavaScript, so anyone could open developer tools and copy them. Now the browser holds no keys. A small server function holds Otari keys and checks each user's login before every call.
- **Limited damage if something leaks.** Each partner org has its own Otari key with its own budget and model allow-list. A misused key can't overspend or reach models outside its allow-list, and it can be rotated in Otari without touching code.
- **Org assignment can't be faked.** Evaluators can't move themselves into another organization's budget. Only the admin can assign orgs, and Firestore security rules enforce it.
- **Open-source and self-hostable.** Otari is Apache-2.0. An organization with data-sovereignty requirements, such as a regulator or a UN agency, can run the same gateway on its own infrastructure and the lab works unchanged.

### 💸 Cost tracking & accountability
- **Every call is priced.** Each evaluation record stores, for each of its four LLM calls (English answer, target-language answer, translation, judge): tokens, cost in USD, which provider served it, latency, whether Otari used a fallback, and Otari's request ID for audit.
- **Per-org budgets.** Each partner can be given a budget sized to their grant. When it runs out, Otari stops that partner's requests and nobody else is affected.
- **Cost tracking for funders.** The Otari dashboard breaks down spend by organization, model and hour, and the lab's CSV export now includes cost per evaluation.

### 🌍 A new research finding: the multilingual "token tax"
The new **Cost & Efficiency (via Otari)** dashboard section compares the *same question* in English and in the target language:
- **Input-token ratio** per language: how many more tokens the identical question needs in, say, Amharic or Farsi than in English.
- **Cost ratio** per language and per model.
- Spend split across evaluated model, translation and judge.

This adds an **economic-equity** dimension to the lab's safety findings. Speakers of under-served languages may get *less safe* answers and also *pay more* for them. Without per-call usage data from a gateway, this measurement wasn't possible.

### ⚖️ Better science: choose any judge
- The LLM-as-a-judge used to be fixed to one proprietary model (Gemini). It's now **selectable** from any open-weight or proprietary model, and the judge used is stored on every record.
- A dashboard **Judge filter** lets researchers compare human-vs-LLM agreement across judges. That shows whether *open-weight judges* can evaluate safety in non-English languages as well as proprietary ones.
- The app warns when the judge is the same model being evaluated (self-grading).
- The translation model is also selectable, with a **Manual** option so native-speaker translations can be used. Hand edits to a machine translation are recorded as manual, which supports reproducibility.

### ⚡ Efficiency & reliability
- **One integration instead of five.** Five provider SDKs (Gemini, OpenAI, Mistral, OpenRouter, Hugging Face) and their per-provider error handling were replaced by one OpenAI-compatible call. Five provider-specific code paths became one gateway client, and three SDKs were removed from the app.
- **Automatic fallback.** If a provider drops a model, as Hugging Face did with Apertus 8B mid-study, Otari can route to another provider. Records note when a fallback served the answer.
- **Graceful handling of model differences.** If a model rejects a parameter (e.g. custom temperature or JSON mode), the lab retries without it instead of failing the experiment.

### 🧩 Ease of use
- **Adding a model takes no code change.** Enable it in Otari and it appears in the lab's model pickers, already grouped as open-weight or proprietary.
- **Partners need no Otari account.** They log into the lab as before; the admin handles workspaces and budgets.
- **Onboarding a new organization:** create a workspace and key in Otari, add one Vercel env var, assign evaluators in the app.

### One-sentence pitch
> *Otari turns the Multilingual AI Safety Lab from a single-researcher tool into infrastructure partner organizations can share: every NGO, regulator or agency gets its own governed, budgeted workspace across open and proprietary models; no API keys are exposed; and each safety finding comes with its cost, revealing that speakers of under-served languages can pay more for less-safe AI.*

### Suggested 2–3 minute demo flow
1. **Problem (15s):** the same safety question gets a worse answer in non-English languages.
2. **Setup (30s):** choose an open-weight model under evaluation, a translation model and a different judge, noting the "Open weights" labels and the "billed to the UNESCO workspace" line.
3. **Run (30s):** side-by-side answers with tokens and cost on each card. Submit the human rubric; the selected judge scores in the background.
4. **Dashboard (45s):** filter by judge model to show agreement, then open *Cost & Efficiency* and point to the input-token ratio per language: "the same question costs X× more in Y."
5. **Governance (30s):** the Partner Orgs panel, then the Otari dashboard showing per-workspace spend, budget and allow-list. Close with: no keys in the browser.
