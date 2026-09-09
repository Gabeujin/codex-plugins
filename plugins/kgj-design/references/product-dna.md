# Product DNA contract

Use this contract before a material design decision. It may be stored as a JSON profile matching
`schemas/product-dna.schema.json`.

The v1.2 profile requires a closed seven-contract `genome`. Its optional `lineage` object declares one or more relative parent DNA files, the
`semantic-contract` policy, minimum parent schema versions, and an allowlist of expression overrides.
Run `resolve-lineage` to produce a deterministic lock. Foundation, component, trait, and signature
changes may be declared; semantic token changes are breaking and cannot pass lineage resolution.
Migration compares product identity, genome statements, product context, lineage declarations,
allowed overrides, resolved parent hashes, provenance, and tokens. Token equality alone is never a
compatibility verdict.

## Evidence frame

```text
Product and version:
Primary users and core job:
Frequency, urgency, and error cost:
Domain and data:
Surfaces, devices, input, locale, and themes:
Established identity to preserve:
Observed friction and evidence:
Accessibility, security, permission, performance, and audit boundaries:
Unverified assumptions:
```

## Genome

The genome states what must remain true regardless of expression:

- semantic information and status roles;
- primary and alternate task state transitions;
- keyboard, focus, announcements, and reduced-motion behavior;
- content, terminology, and locale guarantees;
- quantitative data meaning, units, source, and time scope;
- permission, privacy, and evidence boundaries;
- fallback and recovery expectations.

Do not encode the genome only as tokens. Tokens cannot specify behavioral or content contracts.

## Alleles

Define product-owned traits with an intent and an avoid condition:

| Axis | Define | Avoid |
|---|---|---|
| Density | scan rhythm and information capacity | importing consumer spacing into expert work |
| Typography | roles, contrast, Korean behavior, numeric voice | choosing type only for novelty |
| Color | semantic mapping and signature field | copied palettes or color-only meaning |
| Shape and depth | control/surface geometry and hierarchy | universal rounding or decorative glass |
| Motion | functional tempo and rare expressive moments | blocking feedback or brand spectacle |
| Imagery | medium, abstraction, licensing, fallback | placeholder art presented as finished identity |
| Voice | vocabulary, speech level, certainty, recovery copy | borrowed microcopy or blurred risk |
| Data | chart grammar, precision, grouping, annotation | misleading scales or decorative metrics |
| Signature | one memorable product-native interaction or motif | repeating the same signature across every product |

## Expression context

Record the context that activates a trait: product, domain, surface, audience expertise, task, risk,
frequency, viewport, input, locale, theme, content length, and connectivity. Never promote a trait from
one context into a durable global personality label without explicit user intent.

## Mutation

```text
Observed pressure:
Current workaround:
Proposed mutation and layer:
Consumers and owner:
Baseline:
Success and guardrail signals:
Trial window:
Compatibility effect:
Rollback:
Review or expiry date:
Evidence and counterevidence:
```

Pattern states are `experimental`, `candidate`, `stable`, `deprecated`, and `removed`. Evidence and
mutation history are append-only; a later record explicitly supersedes or revokes an earlier one.

## Falsification brief

Before polishing, identify the smallest real phenotype that could prove the DNA wrong. State the main
task, worst realistic content, minimum viewport, failure state, keyboard path, and measurable or visible
success condition. A beautiful still frame is not sufficient.
