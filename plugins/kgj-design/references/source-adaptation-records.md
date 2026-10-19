# Source adaptation records

Core design sources checked 2026-08-27; the MCP annotation specification was checked 2026-09-08.
Core sources are current official pages or official company technology blogs. User-supplied creator demonstrations are separately labelled observational evidence. KGJ adopts reasoning and
contracts, not visual brands, assets, code, or organization-specific processes.

| Source | Adopted | Intentionally rejected |
|---|---|---|
| Toss, design system guidance | progressive component guidance, worst-case states, accessibility as part of the guide | TDS layout, palette, component details |
| Toss, design system as product | reduce reasons to bypass the system; choose flat/compound APIs by actual variability | one framework/API pattern as universal |
| Toss, color migration | semantic single source, measurable and visual checks, staged migration | Toss palette and organization rollout |
| Toss, component making | test a component hypothesis in a real product before system promotion | TDS component appearance and team process |
| Toss, Skill quality rubric | deterministic checks for formal defects and model review for semantic quality | its exact private rubric and grading scale |
| Carbon themes | semantic roles stay stable while values vary | IBM theme names, palette, Sass stack |
| Spectrum tokens | foundation/alias/component inheritance | Adobe values and component decisions |
| Primer tokens | keep base values out of product code; narrow component ownership | GitHub naming syntax |
| GOV.UK contribution criteria | usefulness, uniqueness, user evidence, accessibility, versatility, ownership | UK public-service governance as universal process |
| Primer component status | lifecycle state, supported breaking-change migration, and explicit deprecation | Primer naming and cadence |
| Carbon checklist and deprecations | one definition of done across design/code/docs/accessibility; deprecate before removal | Carbon roles, packages, and schedule |
| Atlassian token migration | incremental inspectable adoption and product-surface migration | Atlassian token names and codemods |
| Atlassian motion | semantic motion intent, reduced-motion path, restrained expressive moments | early-access tokens, exact timings, Atlassian character |
| DTCG format | interoperable typed token vocabulary as a future direction | claiming conformance without round-trip tests |
| Socar Frame 2.0 | system includes policy, components, design-code connection, operation; service composition stays local | company toolchain and credentials model |
| Kurly component refactor | evolve architecture to match actual consumption and maintenance costs | its UMD/CJS/ESM migration as a general prescription |
| Woowahan design-system platform | distinguish core, themed components, and domain patterns; retrieval context is UX | its package names, AWS/RAG implementation |
| MCP ToolAnnotations 2025-06-18 | classify every tool with read-only, destructive, idempotent, and open-world hints | treating hints from an untrusted server as enforcement or authorization |
| NIST AI RMF | govern/map/measure/manage for learning-ledger risks | treating a voluntary framework as certification |
| ICO pseudonymisation guidance | pseudonymisation lowers risk but is not anonymisation | legal compliance claims from a technical design |

The Toss catalog drift check reported 136 discovered articles and no drift on 2026-08-27. Four Toss
originals materially informed KGJ v1.1: the component-guide structure, real-product component
hypothesis testing, the design-system-as-product API discussion, and staged color-system migration.

Public source records are kept independent. This package does not distribute internal research snapshots,
cross-source fusion results, or repository-specific release evidence.

Machine-readable public-source details are in `source-catalog.json`. Internal review receipts and private catalogs are not distributed.

Interaction guidance checked 2026-10-16: Toss Tech's
[interaction design article](https://toss.tech/article/interaction_simplicity) (2025-05-30) supports
device-appropriate controls and runtime prototypes; its conference autoplay and branded templates are
context-specific. The [working-prototype article](https://toss.tech/article/deadend) (2026-06-16)
supports judging motion in code and preserving current task context; its underlay effect and native
framework are not imported. State contracts, async ownership and interruption probes in the
[interaction motion system](interaction-motion-system.md) are KGJ synthesis. No private recording,
frames, source wording or observation timestamps are included in this public-source record.

User-supplied benchmark reference checked 2026-10-16:
[Codefactory video, 04:08-09:01](https://www.youtube.com/watch?v=2lv5xHjLx1c&t=248s).
Architecture assembly, on-foot/vehicle controls and a particle-led explainer are observed examples for
separating domain fidelity, input mapping, motion continuity and runtime checks from generation time.
The creator's model preference, price and comparative speed statements are not adopted as facts or
rankings. The prose-reading segment is outside this design benchmark. No video, screenshot, transcript,
layout or implementation is redistributed. The [benchmark protocol](design-benchmark-evaluation.md)
is newly authored KGJ synthesis, with official sources still required for model/content claims.

Reference handling checked 2026-10-16: [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) supports treating indirect, hidden and multimodal instructions as untrusted, with least privilege and adversarial checks. The [OWASP prevention guide](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) supports layered separation and output verification. The official-first search tiers and claim provenance workflow in [reference evidence and safety](reference-evidence-and-safety.md) are KGJ policy reflecting the current user's request, not a source ranking dictated by OWASP. No attack code is copied; filtering and instructions do not certify resistance.
