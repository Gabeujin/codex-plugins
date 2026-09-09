---
name: govern-design-patterns
description: Evaluate, promote, deprecate, or remove KGJ Design patterns with explicit evidence, accessibility, ownership, lifecycle, and migration gates. Use when repeated product solutions may deserve shared-system status or when a shared pattern must evolve safely.
---

# Govern design patterns

## Evaluate a candidate

1. Name the user job and declared product scope.
2. Treat repetition as a discovery signal only. Test usefulness and uniqueness against existing patterns.
3. Verify real-product usability, worst-case content, errors, empty states, keyboard use, large text,
   reduced motion, assistive technology, relevant devices, and product-specific counterevidence.
4. Record `useful`, `unique`, `usable`, `accessible`, `consistent`, and `versatile` independently.
5. Run `python scripts/kgj_design.py pattern-check <candidate> --evidence-registry <registry>`.
6. Promote to `stable` only when every criterion passes and at least two active, passing, locally hashed
   evidence records resolve. Raw IDs, external URLs, failed runs, and held runs are non-binding.

## Evolve safely

Before deprecation, publish a replacement or deadline and migration notes. Before removal, require both
a replacement and deadline, run DNA compatibility diff, and preserve a migration receipt. A visual
refresh is never permission to change semantic meaning silently.
