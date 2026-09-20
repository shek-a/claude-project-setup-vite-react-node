# Project
Yarn workspaces monorepo: `apps/webapp` (React + Vite), `apps/backend` (Node: the business logic, with HTTP as one delivery layer), `packages/shared` (the API contract, types and Zod schemas used by both).
Each bounded context has a glossary in `docs/domain/<context>.md`. Use its terms exactly in code, tests, and UI copy.
Setup, stack, and how to run everything: `README.md`.

# Commands
- Install: `yarn install` (root only, never inside an app)
- Start locally: `yarn workspace backend dev` and `yarn workspace webapp dev`
- Tests for one app: `yarn workspace webapp test` / `yarn workspace backend test`
- Single test file: `yarn workspace <app> vitest run <path>`
- Integration tests (need Docker): `yarn workspace backend test:integration`
- Browser tests: `yarn workspace webapp test:ui` (stubbed) and `test:e2e` (full stack; needs Docker and both apps)
- Typecheck: `yarn workspace <app> typecheck`
- The Stop hook runs only `typecheck` and `test`. Run the integration and browser suites yourself after changing infrastructure, the contract, or a journey.
- Linting runs automatically after every edit, and over every changed file before a turn ends (hooks). Fix what it reports; never add eslint-disable comments.

# Workflow
- IMPORTANT: Test-driven. No production code without a failing test first. Follow the `test-driven-development` skill.
- Never weaken or delete an existing test to get green. If a requirement changed, say so explicitly first.
- New feature or new domain concept: run `/domain-driven-design` before any code.
- New frontend capability: run `/frontend-domain-modeling` before any code (after `/domain-driven-design` if the backend changes too).
- Before calling a feature done, have the `code-reviewer` subagent review the diff.
- Check library and framework APIs against current docs with the Context7 MCP tools (`resolve-library-id`, then `query-docs`) instead of relying on memory; versions change APIs and defaults.
- Never end a turn with failing tests or type errors; a Stop hook enforces this.

# Architecture
- The backend owns the business rules and is the source of truth; HTTP is one delivery layer. The frontend never re-implements a domain invariant.
- Every endpoint is declared once in `packages/shared` as a contract (method, path, request/response/error schemas, and each error's HTTP status); both apps bind to it, and neither declares a URL or shape of its own.
- A contract change updates both apps in the same change.
- `packages/shared` must not use Node-only or browser-only APIs.
- Every tsconfig extends `tsconfig.base.json`. Never loosen its strict flags in a workspace; fix the code instead.
