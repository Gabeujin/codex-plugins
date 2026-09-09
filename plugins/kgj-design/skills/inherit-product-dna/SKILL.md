---
name: inherit-product-dna
description: Discover or refine a product's KGJ Design DNA, lineage, invariant contracts, expressive traits, and mutation boundaries. Use before a material redesign, when several products should feel related without looking identical, or when product identity is too vague to guide implementation.
---

# Inherit Product DNA

Read [architecture](../../references/architecture.md),
[product DNA](../../references/product-dna.md), and
[token system](../../references/token-system.md).

## Establish evidence

Inspect existing product surfaces and behavior before interviewing style preferences. Separate facts,
observations, assumptions, and aspirations. A screenshot can reveal expression; it cannot prove
workflow semantics, accessibility, performance, or user preference.

## Produce the lineage contract

Define four layers:

1. **Genome:** semantic roles, state behavior, accessibility, data truth, content guarantees, and
   safety constraints that descendants must preserve.
2. **Alleles:** product-owned choices for voice, density, typography, palette, shape, illustration,
   motion character, and signature moments.
3. **Expression context:** domain, task frequency, risk, viewport, input method, theme, locale, and
   content length that determine which alleles become visible.
4. **Mutation policy:** evidence, experiment, compatibility, success, rollback, owner, and expiry.

Classify each candidate trait as `inherit`, `translate`, `re-derive`, or `forbid`. Keep an explicit
reject list so references cannot silently become templates.

## Required output

Return a reviewable DNA brief and, when files are useful, instantiate
`../../assets/templates/product-dna.json`. Include evidence gaps and the first phenotype that can
falsify the design direction. Do not declare a shared component merely because two screens look
similar.
