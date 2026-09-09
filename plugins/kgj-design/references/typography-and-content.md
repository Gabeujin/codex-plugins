# Typography and content

## Typography is a role system

Define display, title, body, label, code, and numeric roles before choosing sizes. Preserve hierarchy at
200% text zoom and with long Korean strings. Use fluid scaling only when it keeps predictable wraps and
does not make operational content unstable.

- Prefer locally available system stacks unless a font is central, licensed, bundled, and performance-tested.
- Test Hangul, Latin, numbers, punctuation, filenames, URLs, and code together.
- Give long-form body copy a readable measure and line height; dense tables and controls use a separate
  compact role rather than shrinking all text.
- Keep status, identifiers, dates, units, and actions distinguishable without color alone.
- Avoid orphaned Korean particles by fixing overloaded sentences before forcing CSS line breaks.

## Product voice

Write the user's action, consequence, status, and recovery in familiar terms. Keep speech level
consistent. Use English in parentheses only when it teaches a durable domain term. Separate example,
generated, saved, verified, rejected, and deployed states.

Errors answer:

1. what happened;
2. what remains safe;
3. what the user can do now;
4. where to get detail if needed.

## Quantities and identifiers

Format user-visible quantities with the active locale once the whole-number part reaches 1,000. For
Korean interfaces, examples include `1,000`, `10,200`, and `11,000,000`. Editable inputs display grouped
values but normalize separators before parsing while preserving sign, decimal precision, validation,
accessibility, and mobile input behavior.

Do not group identifiers: years, dates, times, phone numbers, postal codes, versions, account IDs,
model codes, hashes, ports, or coordinates unless their domain explicitly defines them as quantities.

## Markdown and reports

Let semantic structure carry the design. Use headings for hierarchy, lists for sequences or sets, and
tables for exact mappings. In HTML reports, preserve selectable text, print layout, source proximity,
long-URL wrapping, and explicit proof boundaries. Do not use decorative callouts to imply certainty.
