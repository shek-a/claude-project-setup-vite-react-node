---
paths:
  - "apps/webapp/**/*.{ts,tsx}"
---

# React rules

## No prop drilling
A component must not receive a prop only to pass it to a child. Fix in this order:
1. Composition: pass the child in via `children` or a slot prop so the parent never needs the data.
2. Move state down to the lowest component that uses it.
3. Server data: call the feature's query hook in the component that needs it (the query cache dedupes requests).
4. Shared client state within one feature: a feature-scoped context or store.
Do not create app-wide context just to avoid passing props; app-wide context is only for cross-cutting state (current user, theme, locale).

## Components
- Components are function declarations with a props `interface`; no `React.FC`. Handlers defined inside a component are `const` arrow functions named `handleX`, where X is the intent (`handleReserveCar`, never `handleSubmit`). Handler props are `onX`; hooks are `useX`.
- Keep components small (ESLint caps them at 80 lines). Extract a child when a block of JSX is reused, has its own state, or is a self-contained unit. More than about 5 to 7 props means the component does too much.
- Separate components that fetch and orchestrate from presentational ones (props in, markup out).
- List items get a stable, unique `key`, never the array index. Never mutate props or state.
- Route paths, query keys, and storage keys are defined once, as `as const` objects or a query-key factory.

## Effects
- `useEffect` synchronises with external systems (subscriptions, timers, the DOM). Never use it to compute derived data (do it during render), handle an event (do it in the handler), reset state when a prop changes (remount with `key`), or fetch (use the feature's query hook).
- The cleanup test: if nothing needs undoing, it probably shouldn't be an effect.
- `useMemo` only for genuinely expensive calculations.

## Structure
- Organize features by user capability or journey (`src/features/book-rental/`), not by backend context; a feature may use published data from several contexts.
- Domain concepts several features use (a model, its mapper, a `CarCard`) go in a shared domain, `src/domains/<context>/`. `src/ui/` is the generic kit: anything that imports a domain concept belongs in a feature or shared domain instead.
- Inside a feature: `model/` (pure types and calculations), `application/` (workflow hooks and user actions), `api/` (clients, query hooks, DTO mappers), `ui/` (components), `index.ts` (public interface). Start with `api/` and `ui/`; add the others when the journey needs them.
- Features and shared domains import each other only through `index.ts`; a shared domain never imports a feature, and `src/ui/` imports neither (ESLint enforces this).
- `model/` is pure TypeScript: no React, no query library, no DTO types (ESLint enforces the imports).
- DTOs stop at `api/`: parse responses with the shared schema and map them to the feature's model. Components never see DTOs.
- Components render. Workflow logic lives in `application/` hooks; derivations, business conditions, and state updates are named pure functions in `model/`.
- Server state stays in the query cache; never copy it into local state. Never store derived state; compute it.
- Name user actions after the user's intent (`reserveCar`), and model their outcome as a discriminated union, including the API's named rejections.
- The backend owns business rules. Never re-implement them (availability, eligibility, pricing); show what the API publishes. Client-side validation is for usability only; always handle the API rejecting a request.
- Everything in the web app's environment is bundled into the JavaScript the browser downloads, and Vite only exposes `VITE_`-prefixed variables: put no secrets there. A value that must stay secret belongs to the API, which exposes only what the contract publishes.
- Before building a new capability, run the `frontend-domain-modeling` skill; it has examples of each rule above.

## Examples
- Worked examples of these rules: `.claude/skills/coding-standards/react.md`. Layering and domain modeling: the `frontend-domain-modeling` skill.

## Tests
- Follow `.claude/skills/test-driven-development/frontend.md`: capability test files, render through the real tree with `renderWithProviders`, accessible queries, MSW at the network.
