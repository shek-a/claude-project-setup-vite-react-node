---
paths:
  - "apps/webapp/**/*.tsx"
---

# Tailwind rules

ESLint (`eslint-plugin-better-tailwindcss`) enforces canonical class order and rejects conflicting, duplicate, unknown, and deprecated classes, class names built dynamically, and arbitrary values. These rules cover what it can't check; `.claude/skills/coding-standards/tailwind.md` has an example of each.

- Extract a component when the same classes appear in more than one place or represent a reusable UI concept (button, input, card, badge); never copy the class string. Keep short, one-off layout classes inline.
- Never move a class list into a JS constant or an `@apply` rule just to shorten a line. If it is worth naming, it is worth a component. `@apply` is only for tiny global primitives.
- Model a component's variants (intent, size, state) with `cva`, not conditional strings. Compose conditional classes with `cn()` (`clsx` + `tailwind-merge`), never template literals.
- Use theme tokens (`p-4`, `text-sm`, `text-brand`). A value that belongs to the design goes into `@theme` in the CSS entry file (`--color-brand: ...`) and is then used by name; Tailwind 4 has no `tailwind.config.js` theme.
- Responsive, state, and dark-mode variants (`md:`, `hover:`, `focus-visible:`, `dark:`) stay inline until an element becomes hard to read; then extract a component or a `cva` variant.
- `cn()`, `Button`, and other styled primitives with no domain concepts live in `src/ui/`.
- Never remove a focus indicator without a visible replacement (`focus-visible:ring-2`). Never carry meaning by color alone; add text or an icon. Style semantic elements; don't replace them with styled `div`s.
