# Multilingual LLM Safety Evaluation Lab

**Do AI models give people the same safe, accurate, well-sourced answer in their own language as in English?** This lab helps anyone deploying an LLM to serve multilingual users (governments, UN agencies, NGOs, companies and developers) find out before they launch. It shows where models fail in each language and context, and what an evaluation costs.

- **Live:** https://ai-safety-evaluation-lab.vercel.app
- **Demo:** https://www.multilingualailab.com/demo (old -- should be updated)
- **Built with [Otari](https://otari.ai)** (Mozilla.ai's open-source LLM gateway).

## What it does

You ask the same question in English and in a target language. The lab runs both side by side, and human evaluators along with llm-as-a-judge score and compare the answers. It covers three modes:

| Mode | What you test |
|---|---|
| **Single prompt** | One answer per language, scored on custom rubric (preloaded with actionability, factuality, fairness and bias, tone and grammar, refusals) |
| **Conversation** | The same multi-turn conversation in both languages. Each reply is flagged OK / Concerning / Unsafe, and the lab records the turn where safety first breaks down in each language. |
| **Web research agent** | The model searches the web to answer. The lab records the queries it wrote and their language, every result with its rank, the pages it opened and the pages it cited. Each website is labelled by type (government, UN, NGO, news, **state-affiliated media**…), country and language. |
| Voice | Coming soon |


## Why build evaluations on Otari.ai

An evaluation is a comparison. Its results only mean something if the one thing that changes is the thing you're testing: the model, the language or the judge. A gateway like [Otari](https://otari.ai) is what keeps everything else the same.

When I presented the lab, organisations kept asking three questions:

1. **"Can we use our own model of interest for every role: the answering model, the translator and the judge?"** Before Otari, no. Two roles were hard-wired to Gemini.
2. **"What will an evaluation cost us?"** I couldn't say. Could their budget cover 10 models or 15? 100 scenarios per model or 200? How many languages?
3. **"Is it safe for our team to use?"** Not really. Provider keys were built into the public website.

Otari answered all three:

| | Before | With Otari |
|---|---|---|
| **Model under evaluation** | 5 provider SDKs, 5 keys, 5 code paths | One connection. Open-weight models (DeepSeek, GLM, Qwen, Mistral, gpt-oss, Apertus) and proprietary ones (OpenAI, Anthropic, Gemini) share one picker, labelled *Open weights* or *Proprietary*. |
| **Translation** | Always Gemini | Any model, or *Manual* for human translation. The record notes when someone edited a machine translation. |
| **LLM judge** | Always Gemini | Any model, saved on every record. The dashboard can filter by judge and warns when a model is grading itself. |
| **Keys** | In the public website's code | Only on the server (`api/llm.ts`), behind a login check that picks the user's organisation key |
| **Partner organisations** | none | Each NGO, regulator or UN agency gets its own Otari workspace, key and budget. Partners don't need an Otari account. |
| **Cost** | Not tracked | For every call the lab saves tokens, cost, provider, response time, fallback and the Otari request ID. A Cost & Efficiency dashboard and the CSV exports show them. |
| **Evaluation modes** | Single prompt only | Single prompt, **multi-turn conversation** and a **web research agent** |

### What this means for evaluation builders

- Partners want to test the model they actually plan to deploy, often an open-weight model they could host themselves, next to the frontier models.
- Without a gateway, every new provider means a new SDK, key, error format and code path; with Otari, it's one API and one key, and switching models is a dropdown. 
- An LLM judge is a model with its own language blind spots. Locking the judge to one vendor builds that vendor's bias into every score, and a model may grade its own answers kindly; with a gateway you can run different judges on the same answers. You can check which ones agree with human annotators.
- In web research mode, "Same for all" gives every model the same search engine through Otari, so you compare models, not search engines. Some open-weight models have no web search of their own; without a gateway, they couldn't be tested as agents at all.
- Organisations have to decide how many models, languages and scenarios they can afford to test:

> **cost ≈ models × languages × scenarios × calls per scenario × cost per call**

- Otari reports the actual cost of every call, including web searches, and the lab stores it per model, language, scenario and role (answer, translation, judge).
- A small pilot gives you the real cost per scenario. Multiply it up to plan the full study.
- Cost also differs by language. The same question can need more tokens in under-served languages (the multilingual "token tax"), and the dashboards make that visible.
- Each partner organisation gets its own Otari workspace and **budget cap**, so a study can't overspend, and spend reports go straight into grant and funder reporting.

**Keep keys safe and partners separate.** No API keys reach the browser. Each partner organisation's calls go through its own Otari key and budget, and Otari is open source and can be self-hosted, for organisations with data-sovereignty requirements.

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

## What the web research agent reveals

- **Different language, different web.** The same question in Farsi and English returns different websites, from different countries, in different languages. "Websites cited in both languages" measures the overlap.
- **Search language.** Does a model asked in Farsi search in Farsi, English or both? Asked about Greece, DeepSeek switched to Greek for its second search.
- **Translation shortcuts.** Some models search in English and then answer in Farsi. The answer looks local, but the sources aren't, and the user may not be able to read them.
- **Thin coverage.** In low-resource languages, models may fall back on forums, aggregators or state-affiliated media, which can be unsafe for refugee and diaspora communities.
- **Limits.** Source labels are AI suggestions until an annotator confirms them. Search results change between runs, so draw conclusions from many runs.

## Feedback for Otari

**What didn't work**
- **Open multilingual models outside Otari's default list are hard to reach.**
  - With my own Hugging Face key, Otari offered only a preselected list of 20 Hugging Face models. SwissAI's Apertus, trained on 1,000+ languages, wasn't one of them.
  - After I added it by hand, it showed as unpriced and switched off ([otari#3062](https://github.com/mozilla-ai/otari/issues/3062)).
  - As a workaround, the lab's pickers accept any model ID.
- **Three web search formats** (Anthropic `/messages`, OpenAI `/responses`, `otari_web_search`) needed three converters to compare models.
- **429 "Model busy"** on open-weight models, with no automatic retry. Any fallback must stay on the same model, or the comparison breaks.
- `otari_web_fetch` rejects `max_uses`, while `otari_web_search` accepts it.
- Own-key models were missing from `/models`; they only appeared in `/catalog/models`.
- `cost_usd` is a string.

**Feature requests**
1. Open Hugging Face models without manual steps.
2. One web search trace format.
3. Same-model retry and fallback on 429.
4. Cost reporting per language, using request metadata.
5. `max_uses` on `otari_web_fetch`.
6. One complete model list.
7. A numeric `cost_usd`.
8. Documented search coverage per language.

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
