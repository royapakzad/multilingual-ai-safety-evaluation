# Multilingual AI Safety Evaluation Laboratory

#### 👩🏻‍💻 Web Platform for Evaluators:  [Multilingual LLM Safety Evaluation Lab](https://ai-safety-evaluation-lab.vercel.app/)
#### 📽️ Demo video 👇
[![Watch the video](https://github.com/user-attachments/assets/643224c8-4c1d-4494-9020-43e6dc0ed9a7)](https://www.multilingualailab.com/demo)


---

## 1. Introduction: The Importance of Multilingual Evaluation

The **Multilingual AI Safety Evaluation Laboratory** is a research tool designed to address an important gap in AI safety: the evaluation of Large Language Models (LLMs) in non-English contexts.

While most LLM development and testing is English-centric, the majority of the world's population does not speak English. This creates a blind spot where models may be less helpful, less accurate, or even more dangerous when used in other languages.

This lab's primary purpose is to empower researchers, developers, and policymakers to rigorously assess **how model performance and safety aspects change across different languages**. It provides the tools to move beyond assumptions and gather concrete evidence, ensuring that AI systems are developed and deployed in a way that is equitable, fair, and safe for global, multilingual populations.


---

## Powered by Otari

Every model call in the lab goes through [Otari](https://otari.ai), Mozilla AI's open-source AI gateway. That covers the model under evaluation, the translation model and the LLM-as-a-judge.

- **Open and proprietary models in one place.** Open-weight models (DeepSeek, GLM, Qwen, Llama, Mistral, Apertus …) and proprietary ones (OpenAI, Anthropic, Google) appear in the same pickers, labelled **Open weights** / **Proprietary**.
- **No API keys in the browser.** Calls go through a small server function (`api/llm.ts`) that checks the user's login and holds the keys server-side.
- **A workspace per partner organization.** Each NGO, regulator or agency gets its own Otari workspace, key, budget and model allow-list. Partners don't need an Otari account.
- **Cost on every evaluation.** Tokens, cost, provider, latency and fallbacks are recorded for each call, which lets the lab measure the multilingual "token tax": how much more the same question costs in under-served languages.

See **[OTARI.md](OTARI.md)** for architecture, setup and details.

---

## 2. Core Capabilities

The platform is built around a comparison lab and a meta-evaluation system, all designed with a multilingual focus.

### A. Systematic Multilingual Evaluation
The lab’s core function enables a direct comparison of an LLM’s response to an English prompt with its response to the same prompt translated into another non-English language, selected by the evaluator from a drop-down menu. Both the English and non-English prompts are run on the chosen LLM (selected from the model menu), allowing evaluators to view the responses side by side and assess them using a human rights-based rubric.

Evaluators choose three models for each experiment, all through Otari:

| Role | What it does |
|---|---|
| **Model under evaluation** | Answers the English prompt and the translated prompt |
| **Translation model** | Translates the English prompt into the target language. Choose **Manual** to paste a human translation instead; hand edits to a machine translation are also recorded as manual |
| **LLM-as-a-judge** | Scores both answers with the same rubric the human uses |

Each response card shows its tokens, cost and response time.

- **Performance Degradation:** Does the quality, accuracy, or coherence of the answer decrease in the target language?  
- **Logical Inconsistencies:** Does the model contradict itself or show flawed reasoning in one language but not the other?  
- **Safety Guardrail Failure:** Are safety filters weaker or more easily bypassed in non-English interactions?  

### B. Human Rights-Based Evaluation Rubric
Evaluations use a rubric derived from the **[UN B-Tech Project’s GenAI taxonomy of harm](https://www.ohchr.org/en/documents/tools-and-resources/taxonomy-generative-ai-human-rights-harms-b-tech-gen-ai-project)**. This specialized framework is designed to measure the human rights impact of AI-generated content, making it particularly relevant for vulnerable, non-English-speaking communities. The evaluation is structured around the following core dimensions, each mapped to specific human rights principles:

*   **Actionability and Practicality:** Assesses if the information is effective and helpful.
    *   *B-Tech Alignment:* Connects to the **Right to an Effective Remedy**, as practical guidance is the first step toward accessing justice.
*   **Factuality:** Evaluates the accuracy and verifiability of information provided.
    *   *B-Tech Alignment:* Upholds the **Freedom of Expression and Access to Information**, which implies access to *accurate* information, and protects the **Right to Life and Security** in high-stakes scenarios.
*   **Safety, Security, and Privacy:** Measures risks to the user's physical, mental, or digital safety.
    *   *B-Tech Alignment:* Directly relates to the **Right to Life, Liberty and Security** and the **Right to Privacy**.
*   **Tone, Dignity, and Empathy:** Assesses if the response is respectful and context-aware.
    *   *B-Tech Alignment:* Corresponds to the **Right to be Treated with Humanity and Respect for Dignity**.
*   **Non-Discrimination & Fairness:** Checks for biases, stereotypes, or discriminatory language.
    *   *B-Tech Alignment:* Enforces the **Right to Equality and Freedom from Discrimination** and protection against discrimination.
*   **Freedom of Access, Censorship, and Refusal:** Determines if the model inappropriately censors safe content or refuses valid questions.
    *   *B-Tech Alignment:* Scrutinizes potential infringements on the **Freedom of Expression and Access to Information**.


### C. "LLM as a Judge" Meta-Evaluation
The platform supports research into the scalability and reliability of AI evaluation itself. By comparing human scores to those of an “LLM Judge” (any open-weight or proprietary model the evaluator selects, stored on every record), the lab explores whether automated evaluation systems can capture nuanced, language-specific failures—an essential step toward building globally relevant evaluation standards.

### D. Interactive Dashboard (Multilingual Disparity & Model Analytics)
An interactive, filterable dashboard provides both high-level and detailed views of evaluation results. Users can refine data by language pair and model, then explore comparisons of English vs. native language outputs across performance metrics (generation time, word counts, reasoning length), rubric-based human scores (via radar charts), and multilingual disparities (heatmaps). It also visualizes human vs. LLM judge assessments through stacked bars, highlights agreement rates, and enables cross-model comparisons of quality, disparity flags, and performance.

A **Judge Model** filter compares human–LLM agreement across different judges, including open-weight vs. proprietary ones. The **Cost & Efficiency (via Otari)** section shows spend by role (evaluated model, translation, judge) and compares the *same question* in English and in each target language: input/output tokens, cost, and the ratio between them, per language and per model.

<img width="1190" height="886" alt="Screenshot 2025-09-23 at 10 39 22 AM" src="https://github.com/user-attachments/assets/f09f73b8-bb06-4944-9700-a558274ba104" />

<img width="1194" height="380" alt="Screenshot 2025-09-23 at 10 40 07 AM" src="https://github.com/user-attachments/assets/7c3c7e4d-2735-417c-94c9-3dbd4957cb24" />

<img width="1338" height="451" alt="Screenshot 2025-09-23 at 10 40 37 AM" src="https://github.com/user-attachments/assets/ef178a40-2c83-411e-af79-2418c7a2f174" />

<img width="1334" height="771" alt="Screenshot 2025-09-23 at 10 40 49 AM" src="https://github.com/user-attachments/assets/a4b5d1d5-1d93-45e8-ab06-e839e2c390fd" />





---


## 3. Benefits: Why Multilingual Evaluation Matters for Responsible AI

The **Multilingual Evaluation Lab** is a **platform** that helps governments, international agencies, researchers, and civil society organizations to **actively evaluate, benchmark, and understand** how AI systems perform across languages and cultural contexts. By making evaluation accessible and transparent, it empowers stakeholders to shape safer, more inclusive technologies.

- **Revealing Hidden Risks Across Languages:**  
  Detect safety gaps and disparities that only appear in non-English interactions, allowing organizations to address risks before deployment.  

- **Supporting Governance & Procurement:**  
  Provide a practical evaluation environment and standardized benchmarks that decision-makers can use to inform procurement and oversight practices.  

- **Advancing Safer AI Development:**  
  Highlight *where* and *why* models fail in specific languages or domains, offering actionable insights for fine-tuning, safeguards, and culturally sensitive design.  

- **Promoting Equity & Building Capacity:**  
  Ensure AI systems work safely and fairly for marginalized language communities while raising broader awareness of multilingual safety issues. The platform creates shared space for policymakers, developers, and civil society to collaborate on solutions.  


---

## 4. Future Development Roadmap

### Model-Centric Enhancements
- **Agentic System Evaluation:** Multi-turn, task-oriented safety testing.  
- **Structured Red Teaming Integration:** Adversarial prompt modules for language-specific vulnerabilities.  
- **Multi-modal Evaluation:** Assess models across images, audio, and video generation.  
- **Enhanced Analytics & Tracking:** Dashboards to monitor multilingual safety drift over time.  
- **Advanced Internationalization & Localization:** Evaluate contextual nuance, dialects, and cultural appropriateness.

### Data & Benchmarking
- **Evaluation-to-Benchmarking Pipeline:** Integrate evaluator contributions directly into a frozen benchmark, enabling reproducible tests and standardized comparisons across models and languages.  
- **Continuous Benchmark Updates:** Establish transparent versioning (v0.1, v0.2…) so the platform evolves as new languages, domains, and harms are added.   

---

## 5. Access Control & Login

The application features a two-level access system:

*   **Admin Access:**
    *   **Permissions:** Admins can view all evaluations submitted by all users and download a complete CSV of all data from the platform. Admins also review **Access Requests** and manage **Partner Orgs**: assigning evaluators to a partner organization so their model calls are billed to that organization's Otari workspace.
    *   **Login:** The admin is the Firebase account with the admin email set in `services/authService.ts` and the Firestore rules in `FIREBASE_SETUP.md`.

*   **Evaluator Access:**
    *   **Permissions:** By admins, evaluators can conduct experiments, submit evaluations, view only their own past evaluations, and download a CSV of their own data.

## 6. Running Your Own Evaluation

This section is for evaluators — anyone who wants to test a model in their own context, not for developers setting up the app.

### Getting an account

There's no open sign-up. To get access:

1. On the login screen, click **Request Access**.
2. Enter your email and a short note on what you plan to evaluate.
3. An admin reviews and approves the request, and sends you a temporary password.
4. Log in with it, then set your own password under **Change Password** in the header.

### Starting an evaluation

After logging in, you'll be asked to name your evaluation. This name keeps your results separate from everyone else's:

- Type a new name and click **Enter Lab** to start fresh.
- Or click an existing name to continue it — your scenarios, criteria, and results are all saved under that name.

Everything below happens inside whichever evaluation you're currently in.

### Choosing models

At the top of the lab, pick the **model under evaluation**, the **translation model** and the **LLM judge**. The lists show only the models your organization's Otari workspace allows. Your choices are remembered for next time, and the panel shows which workspace your calls are billed to.

### Adding scenarios

Then either:

- **Write one scenario at a time** — enter your own prompt directly, or
- **Upload a CSV** to load many scenarios at once.

The CSV needs exactly two columns:

| Column | Content |
|---|---|
| `context` | A short label for the scenario (e.g. "Fact-check - climate claim") |
| `prompt` | The prompt to send to the model |

Rules:
- The first row is the header, with exactly these column names (order doesn't matter).
- **No commas inside `context` or `prompt` text** — the upload can't handle a comma inside a field, and it will split the row into the wrong columns. Use a dash or semicolon instead.
- Every row after the header is one scenario.

### Choosing what to score

Each scenario is scored against a rubric: six built-in dimensions (Actionability, Factuality, Safety, Tone, Non-Discrimination, Censorship/Refusal), plus anything you add.

- **Remove a built-in dimension** that doesn't apply to your context — click **Remove** next to it in the scoring form. Click **Restore** to bring it back.
- **Add your own criterion** — click **+ Add Criterion**, name it, describe it, and write your own answer options from best to worst (custom criteria are always your own wording, not a generic 1-5 scale).
- Define a custom criterion once and it carries over to every new scenario in that evaluation automatically. Remove it and future scenarios stop getting it too.

These choices only apply to the evaluation you're in — starting a new one gives you the built-in six again, with no custom criteria until you add them there.

## 7. Configuration

The app is a Vite + React site on Vercel, with Firebase for login and data and one Vercel serverless function (`api/llm.ts`) that sends model calls to Otari. **No API keys are compiled into the website.** `env.js` is generated at build time and contains no secrets.

#### A. Otari
In the [Otari dashboard](https://otari.ai):
1. **Organization → Providers:** add your provider keys (OpenAI, Anthropic, Mistral, Fireworks …), or use Otari-managed keys with a balance top-up.
2. **Organization → Workspaces:** create a `Lab default` workspace, plus one per partner organization.
3. In each workspace, go to **API Keys → Create Key**. Optionally restrict which models the key can use.
4. **Organization → Spend & Budgets:** add a budget and attach a ceiling to each partner's workspace.

Step-by-step details are in [OTARI.md](OTARI.md).

#### B. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `OTARI_KEY_DEFAULT` | **Required.** The Otari key from the `Lab default` workspace |
| `OTARI_KEY_<ORG_ID>` | One per partner organization, e.g. `OTARI_KEY_UNESCO`. The **Partner Orgs** panel shows the exact name |
| `OTARI_BASE_URL` | Optional. Defaults to `https://api.otari.ai/api/v1` (EU: `https://eu.api.otari.ai/api/v1`) |

These are only read by the server function and never reach the browser. Provider keys from earlier versions (`API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `HUGGINGFACE_API_KEY`) are no longer used. Delete them, and rotate them at each provider if they were ever deployed.

#### C. Firebase
Follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md) and publish its Firestore rules. They include the admin-only `orgMemberships` collection used for partner organizations.

#### D. Local development
`/api/llm` is a Vercel function, so run the app with the Vercel CLI instead of `npm run dev`:
```bash
npm install
npx vercel link        # once
npx vercel env pull    # downloads the env vars into .env.local (gitignored)
npx vercel dev
```

## 8. Codebase Philosophy & Best Practices

This project is structured for modularity and maintainability. Key principles for developers include:

*   **Separation of Concerns:**
    *   **`types/`**: All TypeScript type definitions are located here, broken into logical files (e.g., `evaluation.ts`, `models.ts`).
    *   **`constants/`**: All application-wide constants are here, also broken into files (e.g., `api.ts`, `rubric.ts`).
    *   **`components/`**: Contains all reusable React components.
    *   **`services/`**: Houses logic that interacts with external APIs (`llmService.ts` for the Otari gateway, `orgService.ts` for partner organizations) or performs self-contained business logic (`textAnalysisService.ts`).
    *   **`api/`**: Vercel serverless functions. `llm.ts` verifies the user's login, picks their organization's Otari key and forwards the call.
*   **Single Source of Truth:** By using the `constants/` directory, we avoid magic strings and ensure that values like model IDs or local storage keys are defined in only one place.
*   **Clean Imports:** The `index.ts` file in both `types/` and `constants/` allows for clean, simple imports (e.g., `import { User } from './types';`).
*   **Clear Commenting:** Add concise, professional comments to explain the *why* behind complex code, not just the *what*.

## 9. File System Overview

```
llm-safety-lab/
├── api/
│   └── llm.ts          # Server-side Otari gateway (keys live here, not in the browser)
├── components/         # React components
├── constants/          # App constants (models, rubric, etc.)
├── services/           # API clients and business logic
├── types/              # TypeScript type definitions
├── public/
│   └── scenarios.json  # Not currently used, but available for future features
├── App.tsx             # Main application component
├── env.js              # Generated at build time, no secrets (gitignored)
├── index.html
├── index.tsx
├── README.md           # This file
├── OTARI.md            # Otari integration: architecture, setup, write-up
├── FIREBASE_SETUP.md   # Firebase + Firestore rules
└── llmtaskscompleted.md # Log of completed work
```
## 10. Credits & Acknowledgments

This project was developed as part of the Mozilla Foundation Trustworthy AI Program, under the Senior Fellowship of Roya Pakzad.
Special thanks to all contributors, evaluators, and civil society partners who participated in testing and evaluation. Contact rpakzad@taraazresearch.org for support.

---
