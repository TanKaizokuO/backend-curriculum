# Language anchor: Python first, TypeScript layered deliberately

The learner knows Python well and is rusty on JavaScript, and asked which to use. Decision:
**anchor on Python with FastAPI; add TypeScript once the first Python API is deployed** — not
before, and not "someday." Recorded because every future lesson's code, framework choice, and
project scaffolding depends on it, and because the evidence does *not* trivially favour Python.

## Evidence

The honest reading of the data is that Python is the weaker *backend* ecosystem:

- Among **professional** developers, Node.js is used by 49.1% versus FastAPI 15.1%, Flask 13.2%,
  Django 11.7% — Node alone exceeds all three Python frameworks even when (incorrectly) summed.
  [SO 2025, professional web-framework cut](https://survey.stackoverflow.co/2025/charts/stackoverflow-dev-survey-2025-technology-most-popular-technologies-webframe-webframe-prof-social.png)
- TypeScript is the only top-6 language that **gains** share when filtering all respondents →
  professionals (43.6% → 48.8%); Python is the only one that **loses** (57.9% → 54.8%).
  [SO 2025](https://survey.stackoverflow.co/2025/technology)
- TypeScript became the most-used language on GitHub in August 2025.
  [Octoverse 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/)

Three things override that for *this* learner:

1. The binding constraint is **"has never built a server."** HTTP, routing, auth, migrations,
   N+1, and deployment are language-independent. Spending the first ~100 of ~700 annual hours
   re-acquiring JS syntax buys zero backend understanding.
2. Python is not a fallback: **108K postings, ~20% of the market, and accelerating** (21% → 26%
   across 2025). [DevJobsScanner, Jun 2026](https://www.devjobsscanner.com/blog/top-8-most-demanded-programming-languages/)
3. The headline "JS/TS 30% of postings" is **contaminated by React/Angular/Vue frontend roles** —
   that source classifies by job title only. The true backend gap is materially narrower.

## Implications

- Framework is **FastAPI**, not Django or Flask. It leads the official PSF survey (38% vs Django
  35%, Flask 34%, [PSF/JetBrains 2024](https://lp.jetbrains.com/python-developers-survey-2024/))
  and it teaches async, type hints, and OpenAPI properly. **But** job-posting vocabulary lags
  usage — recruiters still write "Django Developer" — so the learner must be able to *read* a
  Django codebase before interviewing, even if they never build in it.
- **Go is ruled out** (~2% of postings, 13K jobs). Fine second language, wrong first anchor.
- TypeScript is **non-negotiable eventually**, because the stated goal includes full-stack and
  there is no full-stack path that avoids it. The target profile is bilingual.
- Revisit trigger: the first Python API deployed to a public URL.

## Known limits of this evidence

Nobody has published a Python-backend vs Python-ML posting split, nor a seniority breakdown.
The common claim that Python backend demand is "mostly ML-adjacent" is a plausible inference
from three converging sources, **not a measured fact** — and if it proved true it would weaken
this decision considerably. Re-examine if better data appears.
