# Browser tests in apps/webapp

Two layers, one `playwright.config.ts`, split by what they talk to. The universal discipline (test behavior, organize by capability, assert real values) is in [SKILL.md](SKILL.md); this file holds the Playwright mechanics.

```
apps/webapp/
├── e2e/
│   ├── ui/           # MSW-stubbed journeys       -> yarn workspace webapp test:ui
│   └── integrated/   # one journey, real API + DB -> yarn workspace webapp test:e2e
└── playwright.config.ts   # projects: ui, integrated
```

Neither script belongs in `test`: the Stop hook runs that on every turn, and it must not need browsers or Docker. Run them yourself after changing a journey, the contract, or the app shell. Both folders must be in a tsconfig `include`, or the lint hook reports files it can't typecheck.

## Both layers

- **Test journeys, not pages.** A spec describes a journey a user would recognise (`booking-a-rental.spec.ts`), not one file per page or component.
- **User-facing locators.** `getByRole` with a name, then `getByLabel`, then text. Test IDs are a last resort, and CSS or XPath selectors never: `page.locator(".btn-primary")` breaks on restyling.
- **Web-first assertions, never hard waits.** `await expect(page.getByText("Your car is reserved")).toBeVisible()` retries until it passes or fails; `page.waitForTimeout(2000)` is flaky by construction. Assert absence with `await expect(locator).toHaveCount(0)`.
- **Each test sets up its own state**, so specs don't depend on order. Put shared setup in Playwright fixtures, and reuse a signed-in session with `storageState` rather than logging in through the UI in every test.
- **Earn the layer's cost.** A browser test is slow. Keep both suites to critical journeys, and leave variants and edge cases to the component tests, which cover them faster.

## `ui`: the stubbed layer

Real browser, real routing, real app shell; the API answers from MSW in the browser, so the suite is fast and can drive any failure on demand.

- The app starts the MSW worker only when a test flag is set, read through the Zod-parsed env config (`rules/typescript.md`), never in a production build.
- The worker uses the same handlers as the component tests, built from the contract's `path` and the shared fixture factories. One change to a fixture reaches the component tests, these journeys, and the API tests together.
- Override a single case in one test with `worker.use(...)` or Playwright's `page.route`, keeping the shared handlers as the happy path.
- Stub genuinely external third parties (payment, email) here and in the integrated layer alike.

```ts
// apps/webapp/src/testing/browser-worker.ts
export const worker = setupWorker(...handlers); // the handlers the component tests use
```

## `integrated`: the full stack

One journey that proves the contract holds at runtime:

```
browser -> real frontend build -> HTTP -> real API -> domain + repositories -> Postgres (Docker Compose)
```

- Playwright's global setup starts the Compose file from [integration.md](integration.md), runs `yarn workspace backend migrate`, then `yarn workspace backend seed:e2e`, which truncates and inserts what the journey needs (a bookable car, a customer). Seeding is a script, so no test-only route reaches production code.
- `webServer` boots the API and the frontend; `use.baseURL` points at the frontend.
- Keep it to the happy path plus at most one failure. Anything more belongs in the `ui` layer, which drives failures without touching data.
- When this fails but the component tests pass, the contract drifted: the path, the payload, or an error shape no longer matches what the API sends.
- Any change spanning both apps, including every contract change, is unfinished until this journey passes. Green unit tests on each side prove nothing about the two of them together.
