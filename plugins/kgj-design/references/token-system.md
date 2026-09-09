# Token system

KGJ uses a three-level graph inspired by current design-token practice while keeping behavior and
content outside tokens.

```text
foundation value -> semantic alias -> component-owned alias
```

## Foundation

Raw values such as palette colors, type families, sizes, spacing, radii, durations, and easing curves.
Only the foundation layer may contain raw values. Every token is a closed `{"$type","$value"}` pair;
foundation names describe the value family, not use.

## Semantic

Stable role names such as `surface.canvas`, `text.primary`, `action.accent`, `motion.fast`, and
`shape.control`. A semantic `$value` must be a `{foundation.*}` alias with the same `$type`. Product DNA
packs assign foundation values to these roles; the required role names cannot change between packs.

## Component

Narrow aliases owned by one component or pattern, such as `panel.border`. A component `$value` must be
a `{semantic.*}` alias with the same `$type`; it cannot become a shortcut for unrelated consumers.

## Rules

- Product code uses semantic tokens; component internals may use their owned component tokens.
- No raw color, spacing, type, radius, duration, or easing values outside foundation allowlists.
- No component-token import outside its owner without a declared derivative.
- All aliases resolve, contain no cycles, and have compatible types.
- Every supported DNA pack resolves every required semantic key.
- A pack may change values and declared assets; it cannot change markup, ARIA, keyboard behavior,
  focus, content rules, state transitions, data meaning, or permission logic.
- Light, dark, forced-color, high-contrast, print, and reduced-motion behavior are verified per supported
  surface rather than assumed from the token graph.

The bundled compiler preserves aliases as CSS custom-property references. Use:

```powershell
python scripts/kgj_design.py compile <profile.json> <output.css>
```

If the profile declares lineage, first run `resolve-lineage` and pass the exact content-addressed lock
with `--lineage-lock`. Compilation rejects a missing, stale, or foreign lock, so a child cannot bypass
parent constraints by calling the compiler directly.

The generated header binds both the DNA source hash and the resolved lineage-lock hash. `doctor`
rejects a token output after either the child source or any parent content changes.

The compiler fails closed on missing required roles, unknown layers, raw semantic/component values,
missing targets, upward or sideways references, and incompatible types. Layer order makes cycles
unrepresentable in the v1 profile contract.

The example schema follows KGJ's bounded profile contract, not full Design Tokens Community Group
Format conformance. Interchange may be added only with round-trip tests and a versioned migration.
