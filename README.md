
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

## 2. Core Capabilities

The platform is built around a comparison lab and a meta-evaluation system, all designed with a multilingual focus.

### A. Systematic Multilingual Evaluation
The lab’s core function enables a direct comparison of an LLM’s response to an English prompt with its response to the same prompt translated into another non-English language, selected by the evaluator from a drop-down menu. Both the English and non-English prompts are run on the chosen LLM (selected from the model menu), allowing evaluators to view the responses side by side and assess them using a human rights-based rubric.

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
The platform supports research into the scalability and reliability of AI evaluation itself. By comparing human scores to those of a Gemini-powered “LLM Judge,” the lab explores whether automated evaluation systems can capture nuanced, language-specific failures—an essential step toward building globally relevant evaluation standards.

### D. Interactive Dashboard (Multilingual Disparity & Model Analytics)
An interactive, filterable dashboard provides both high-level and detailed views of evaluation results. Users can refine data by language pair and model, then explore comparisons of English vs. native language outputs across performance metrics (generation time, word counts, reasoning length), rubric-based human scores (via radar charts), and multilingual disparities (heatmaps). It also visualizes human vs. LLM judge assessments through stacked bars, highlights agreement rates, and enables cross-model comparisons of quality, disparity flags, and performance.

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

### Governance Evaluation
- **Corporate Policy & Transparency Analysis:** Examine companies’ stated AI principles, privacy policies, terms of service, and compliance frameworks against observed model behavior.  
- **Sanctions & Regulatory Compliance:** Conduct nuanced assessments of how companies interpret and enforce international sanctions, export controls, and local regulatory obligations. This includes examining risks of over-enforcement, chilling effects on access, and broader digital rights implications for users in sanctioned or marginalized regions.  
- **Business Model & Incentives:** Assess how monetization strategies, data practices, and product roadmaps affect safety, accessibility, and equity outcomes.  
- **Contextual Vulnerability Assessment:** Map risks for specific user groups and country contexts, linking technical evaluation findings to broader societal impacts.  
 
---

## 5. Access Control & Login

The application features a two-level access system:

*   **Admin Access:**
    *   **Permissions:** Admins can view all evaluations submitted by all users and download a complete CSV of all data from the platform.
    *   **Login:** Admin credentials are set via environment variables. For local development, they can be set in `env.js`. For production (e.g., Vercel), they must be set in your project's environment variable settings (see Section 6 below).

*   **Evaluator Access:**
    *   **Permissions:** By admins, evaluators can conduct experiments, submit evaluations, view only their own past evaluations, and download a CSV of their own data.

## 6. Configuration 

This application requires configuration for both API keys and administrator credentials. This is handled via an `env.js` file for local development and **environment variables** for production deployments (e.g., Vercel).

#### A. For Local Development (Recommended)

1.  **Create `env.js` file:** In the root directory of the project, create a file named `env.js`.
2.  **Add your keys and credentials to `env.js`:**
    ```javascript
    // IMPORTANT: DO NOT COMMIT THIS FILE TO VERSION CONTROL!
    // This file is for local development configuration only.

    // For Google Gemini
    export const API_KEY = "YOUR_GOOGLE_GEMINI_API_KEY_HERE";
    
    // For OpenAI
    export const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY_HERE";

    // For Mistral
    export const MISTRAL_API_KEY = "YOUR_MISTRAL_API_KEY_HERE";

    // --- Admin Credentials ---
    // For local development, you can set the admin user here.
    // In production, these values are ignored; use environment variables instead.
    export const ADMIN_EMAIL = "admin@example.com";
    export const ADMIN_PASSWORD = "your-secure-local-password";
    ```
3.  **Security:** Ensure `env.js` is listed in your `.gitignore` file to prevent accidentally committing secrets.

#### B. For Production Deployment (Vercel, Netlify, etc.)

To deploy your application safely, you **must** set the following environment variables in your hosting provider's project settings:

*   `API_KEY`: Your Google Gemini API Key.
*   `OPENAI_API_KEY`: Your OpenAI API Key.
*   `MISTRAL_API_KEY`: Your Mistral API Key.
*   `ADMIN_EMAIL`: The email address for the admin user.
*   `ADMIN_PASSWORD`: The password for the admin user.

The application is built to automatically use these environment variables when deployed, ensuring your secrets are never exposed in your codebase.
## 7. Codebase Philosophy & Best Practices

This project is structured for modularity and maintainability. Key principles for developers include:

*   **Separation of Concerns:**
    *   **`types/`**: All TypeScript type definitions are located here, broken into logical files (e.g., `evaluation.ts`, `models.ts`).
    *   **`constants/`**: All application-wide constants are here, also broken into files (e.g., `api.ts`, `rubric.ts`).
    *   **`components/`**: Contains all reusable React components.
    *   **`services/`**: Houses logic that interacts with external APIs (`llmService.ts`) or performs self-contained business logic (`textAnalysisService.ts`).
*   **Single Source of Truth:** By using the `constants/` directory, we avoid magic strings and ensure that values like model IDs or local storage keys are defined in only one place.
*   **Clean Imports:** The `index.ts` file in both `types/` and `constants/` allows for clean, simple imports (e.g., `import { User } from './types';`).
*   **Clear Commenting:** Add concise, professional comments to explain the *why* behind complex code, not just the *what*.

## 8. File System Overview

```
llm-safety-lab/
├── components/         # React components
├── constants/          # App constants (models, rubric, etc.)
├── services/           # API clients and business logic
├── types/              # TypeScript type definitions
├── public/
│   └── scenarios.json  # Not currently used, but available for future features
├── App.tsx             # Main application component
├── env.js              # Local API Key Config (gitignore this!)
├── index.html
├── index.tsx
├── README.md           # This file
└── llmtaskscompleted.md # Log of completed work
```
## 9. Credits & Acknowledgments

This project was developed as part of the Mozilla Foundation Trustworthy AI Program, under the Senior Fellowship of Roya Pakzad.
Special thanks to all contributors, evaluators, and civil society partners who participated in testing and evaluation (to be updated with the full list).

---
