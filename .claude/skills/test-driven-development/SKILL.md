---
name: test-driven-development
description: Red-green-refactor workflow for writing or changing any production code in apps/webapp, apps/backend, or packages/shared. Use this whenever implementing a feature, fixing a bug, or changing behavior, even if the user does not mention tests.
---

# Test-driven development

Work from the test list in the spec or `docs/domain/<context>.md`. If there is none, write one first (behaviors as test names, in domain language) and show it to the user. Wait for the user to approve the test list before writing any code.

Repeat for each behavior:

1. **Red.** Write one test for the next smallest behavior. Run only that test. Show the output and confirm it fails for the expected reason (an assertion, not an import or type error).
2. **Green.** Write the minimum production code to pass. Run the test again and show it passing.
3. **Refactor.** With tests green, apply the TypeScript design rules (single responsibility, one level of abstraction per function); the `coding-standards` skill has a worked example of each. Rerun the affected tests.

Rules:
- One behavior per test. Test names read as domain statements, e.g. `rejects an order with no line items`.
- Organize tests around business capabilities, not the source file structure. There is no one test file per class: a file describes one capability (`order-cancellation.test.ts`, not `OrderCancellationService.test.ts`) and exercises whatever classes implement it.
- Test observable behavior through public interfaces. Never test private methods or assert on internal calls.
- Mock only at ports: repositories (the persistence layer), other contexts' public interfaces, external services, the network. Never mock domain objects.
- Assert on the exact values a mock received, captured from `mock.calls` (e.g. the aggregate passed to `save`). Never `expect.anything()`.
- A bug fix starts with a test that reproduces the bug.
- Finish every turn green. Do not stop mid-cycle in red; the Stop hook will block it.
- Green unit tests end a turn, not a task. A task is done when it meets the Definition of done in `CLAUDE.md`, which names the suite each kind of change must pass.

Side-specific guidance:
- Backend (`apps/backend`): read [backend.md](backend.md)
- Backend integration tests (repositories, adapters in `infrastructure/`): read [integration.md](integration.md)
- Browser tests (Playwright, stubbed and full-stack): read [playwright.md](playwright.md)
- Frontend (`apps/webapp`): read [frontend.md](frontend.md)
