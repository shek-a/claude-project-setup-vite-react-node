---
paths:
  - "packages/shared/**/*.ts"
  - "apps/backend/src/*/http/**/*.ts"
  - "apps/webapp/src/**/api/**/*.ts"
---

# API contract rules (shared by both apps)

The contract is the only place the two apps meet. Everything below exists so drift becomes a compile error instead of a production bug.

- Every endpoint is declared once, in `packages/shared/src/<context>/contract.ts`: `method`, `path`, `params`, `request`, `response`, and `errors`. Declare it with `as const satisfies Endpoint` so the shape is checked and the literal types survive.
- No app declares a URL, an HTTP method, or a request, response, or error shape of its own. Never hand-write a type that mirrors one; import it, or infer it from the schema.
- Each context's contract file also exports `ERROR_STATUS`, mapping each error `kind` to its HTTP status, so both sides agree on what a failure looks like.
- API handlers bind to the contract: register the route with `contract.path` and `contract.method`, parse input with `contract.params` and `contract.request`, type the success body as `z.infer<typeof contract.response>`, and map a failed `Result` through `ERROR_STATUS`.
- The web `api/` layer calls through the contract: build the URL with `buildPath(contract, params)`, parse the success body with `contract.response` and a failure body with `contract.errors`, then map into the feature's model and rejection union. DTOs stop there.
- Test data for an endpoint lives beside its contract as a factory (`aReservedRental(overrides)`) that parses through the schema, so a fixture that drifts fails the moment a test calls it. API tests, MSW handlers, and Playwright stubs all use those factories, so a change lands in every suite at once.
- A contract change updates both apps in the same change. Never leave a field or error case that only one side knows about; the Stop hook typechecks and tests both apps whenever `packages/` changes.
- `packages/shared` stays runtime-agnostic: schemas, types, fixtures, and pure helpers only, no Node or browser APIs.
- Worked examples: `.claude/skills/coding-standards/contract.md`.
