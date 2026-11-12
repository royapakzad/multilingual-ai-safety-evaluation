# Multilingual LLM Safety Evaluation Lab

**Do AI models give people the same safe, accurate, well-sourced answer in their own language as in English?** This lab helps anyone deploying an LLM to serve multilingual users (governments, UN agencies, NGOs, companies and developers) find out before they launch. It shows where models fail in each language and context, and what an evaluation costs.

- **Live:** https://ai-safety-evaluation-lab.vercel.app
- **Demo:** https://www.multilingualailab.com/demo (old -- should be updated)

## What it does

You ask the same question in English and in a target language. The lab runs both side by side, and human evaluators along with llm-as-a-judge score and compare the answers. It covers three modes:

| Mode | What you test |
|---|---|
| **Single prompt** | One answer per language, scored on custom rubric (preloaded with actionability, factuality, fairness and bias, tone and grammar, refusals) |
| **Conversation** | The same multi-turn conversation in both languages. Each reply is flagged OK / Concerning / Unsafe, and the lab records the turn where safety first breaks down in each language. |
| **Web research agent** | The model searches the web to answer. The lab records the queries it wrote and their language, every result with its rank, the pages it opened and the pages it cited. Each website is labelled by type (government, UN, NGO, news, **state-affiliated media**…), country and language. |
| Voice | Coming soon |


## Why build evaluations on Otari.ai

I built an early version of this tool in November 2025. Since then, when I presented it, organisations asked three questions:

1. **"Can we use our own model of interest for every role: the answering model, the translator and the judge?"** 
2. **"What will an evaluation cost us?"** 
3. **"Is it safe for our team to use?"** 

Otari answered all three:

| | Before | With Otari |
|---|---|---|
| **Model under evaluation** | 5 provider SDKs, 5 keys, 5 code paths | One connection. Open-weight models (DeepSeek, GLM, Qwen, Mistral, gpt-oss, Apertus) and proprietary ones (OpenAI, Anthropic, Gemini) share one picker, labelled *Open weights* or *Proprietary*. |
| **Translation** | Always Gemini | Any model, or *Manual* for human translation. The record notes when someone edited a machine translation. |
| **LLM judge** | Always Gemini | Any model, saved on every record. The dashboard can filter by judge and warns when a model is grading itself. |
| **Keys** | In the public website's code | Only on the server (`api/llm.ts`), behind a login check that picks the user's organisation key |
| **Partner organisations** | none | Each government agency, NGO, or UN agency gets its own Otari workspace, key and budget. |
| **Cost** | Not tracked | For every call the lab saves tokens, cost, provider, response time, fallback and the Otari request ID. A Cost & Efficiency dashboard and the CSV exports show them. |
| **Evaluation modes** | Single prompt only | Single prompt, **multi-turn conversation** and a **web research agent** |

## Feedback for Otari

**What didn't work**
- **Open multilingual models outside Otari's default list are hard to reach.**
  - With my own Hugging Face key, Otari offered only a preselected list of 20 Hugging Face models. SwissAI's Apertus, trained on 1,000+ languages, wasn't one of them.
  - After I added it by hand, it showed as unpriced and switched off ([otari#3062](https://github.com/mozilla-ai/otari/issues/3062)).
- **Three web search formats** (Anthropic `/messages`, OpenAI `/responses`, `otari_web_search`) needed three converters to compare models ([otari#3145](https://github.com/mozilla-ai/otari/issues/3145)).

**Feature requests**
1. Open Hugging Face models without manual steps (done, issue closed).
2. One web search trace format.
4. Cost reporting per language, using request metadata.

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

Developed by Roya Pakzad (Taraaz) through the Mozilla Foundation Trustworthy AI Senior Fellowship. Thanks to all evaluators and civil-society partners including Respond Crisis Translation. Contact: rpakzad@taraazresearch.org
