# Multilingual LLM Safety Evaluation Lab

**Do AI models give people the same safe, accurate, well-sourced answer in their own language as in English?** This lab lets researchers, NGOs, UN agencies, governments and hotlines find out before they deploy a model. It shows where models fail in each language and context, and what an evaluation costs.

- **Live:** https://ai-safety-evaluation-lab.vercel.app
- **Demo:** https://www.multilingualailab.com/demo
- **Built with [Otari](https://otari.ai)** (Mozilla.ai's open-source LLM gateway). Details: [OTARI.md](OTARI.md)

## What it does

You ask the same question in English and in a target language (Farsi, Kurdish, Pashto, Arabic…). The lab runs both side by side, and human evaluators score and compare the answers.

| Mode | What you test |
|---|---|
| **Single prompt** | One answer per language, scored on a human-rights rubric |
| **Conversation** | The same multi-turn conversation in both languages. Each reply is flagged OK / Concerning / Unsafe, and the lab records the turn where safety first breaks down in each language. |
| **Web research agent** | The model searches the web to answer. The lab records the queries it wrote and their language, every result with its rank, the pages it opened and the pages it cited. Each website is labelled by type (government, UN, NGO, news, **state-affiliated media**…), country and language. |
| Voice | Coming soon |

**Every model role is your choice.** Pick the model under evaluation, the translation model (or translate by hand), the LLM judge and the source-analysis model. Open-weight models (DeepSeek, Qwen, GLM, Mistral, Apertus…) and proprietary ones (OpenAI, Anthropic, Gemini) are in the same picker.

**Web search can be compared fairly.** Use each model's own search, or give every model the same search engine ("Same for all") so differences come from the model and the language, not the search engine.

## How answers are scored

- **Rubric:** six dimensions based on the [UN B-Tech taxonomy of generative AI human rights harms](https://www.ohchr.org/en/documents/tools-and-resources/taxonomy-generative-ai-human-rights-harms-b-tech-gen-ai-project):
  - Actionability
  - Factuality
  - Safety & Privacy
  - Tone & Dignity
  - Non-Discrimination
  - Censorship & Refusal
- **Custom criteria:** remove any built-in dimension and add your own. Web research uses Source quality, Local relevance and Citation support.
- **Human vs LLM judge:** the judge scores the same answers, so you can see whether automated evaluation catches harms in other languages.
- **Cost:** every call records tokens, cost, provider and latency. The dashboards compare English and target-language results and cost per model and language, including the multilingual "token tax". Everything exports to CSV.

## Using the lab

1. On the login screen, click **Request Access**. An admin approves you and sends a temporary password.
2. Name an evaluation and choose its mode.
3. Pick your models, add scenarios (one at a time, or a CSV with `context` and `prompt` columns, no commas inside fields) and run them.
4. Score the answers, then review the dashboard and export.

**Admins** see all evaluations, approve access requests, and assign evaluators to **partner organisations**. Each partner organisation has its own Otari workspace, key and budget.

## Setup

The site is Vite + React on Vercel, with Firebase for login and data. All model calls go through one server function (`api/llm.ts`) to Otari. **No API keys reach the browser.**

1. **Otari:**
   - Add provider keys.
   - Create a `Lab default` workspace, plus one per partner organisation, each with an API key and a budget.
   - See [OTARI.md](OTARI.md).
2. **Vercel environment variables:**

   | Variable | Value |
   |---|---|
   | `OTARI_KEY_DEFAULT` | Required. Key for the `Lab default` workspace |
   | `OTARI_KEY_<ORG_ID>` | One per partner organisation. The Partner Orgs panel shows the exact name. |
   | `OTARI_BASE_URL` | Optional. Defaults to `https://api.otari.ai/api/v1` |

3. **Firebase:** follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md) and publish its Firestore rules.
4. **Local development:**
   ```bash
   npm install
   npx vercel link && npx vercel env pull
   npx vercel dev
   ```

## Credits

Developed by Roya Pakzad (Taraaz) through the Mozilla Foundation Trustworthy AI Senior Fellowship. Thanks to all evaluators and civil-society partners. Contact: rpakzad@taraazresearch.org
