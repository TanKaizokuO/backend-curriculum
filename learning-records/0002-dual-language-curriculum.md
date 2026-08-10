# Dual-language curriculum: Python and TypeScript in parallel

Following the completion of Lesson 7 and the deployment of the initial Python API, the trigger established in [LR-0001](./0001-language-anchor-python-first.md) for introducing TypeScript was reached. 

The learner explicitly requested to pursue both tracks simultaneously: *"I want both. From now on each lesson must teach both TS and python in backend."*

Decision: **From Lesson 8 onward, every backend lesson will cover both the Python (FastAPI) and TypeScript (Node.js/Express or similar) implementations side-by-side.**

## Evidence & Rationale
- The learner has successfully demonstrated the foundational backend concepts (routing, relational modeling, ORM interactions, and deployment) using Python.
- Returning to TypeScript now aligns with the overarching goal of becoming a bilingual, full-stack capable developer, as established in LR-0001.
- Teaching concepts in parallel forces the learner to recognize the underlying patterns (e.g., authentication, middleware) rather than just memorizing language-specific syntax. It highlights where the abstraction is the same and where language idioms differ.

## Implications
- **Curriculum Format**: Future lessons (Auth, Testing, Caching, etc.) will structurally require two implementation sections or a comparative approach.
- **Cognitive Load**: This will increase the density of each lesson. The teaching must clearly separate the conceptual "what and why" from the language-specific "how" to prevent confusion.
- **Repository Structure**: The `Code/js/` parallel directory structure will become a primary, active track alongside the Python code, rather than just a secondary reference.