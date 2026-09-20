# Test-driven development in apps/backend

Work outside-in: start a feature with one failing use-case test, then drive the domain with unit tests until it passes.

| Layer | What to test | Doubles | Share of tests |
|---|---|---|---|
| domain | Aggregate invariants, value object validation, domain events raised | None; pure objects | Most |
| application | Use case orchestration and returned results | Mocked repositories returning real aggregates | Some |
| infrastructure | Repository and adapter behavior against the real dependency | None: real DB in Docker Compose; read [integration.md](integration.md) | Few |
| http | Status codes, schema validation, error mapping | Supertest against the app wired with mocked repositories | Few |

- Mock at the persistence layer: put a typed mock factory next to each repository interface (`mockOrderRepository()`) instead of hand-rolling mocks per test. Mocked finds return real aggregates built with the factory functions below, never mocked domain objects.
- Build test data with small factory functions named in domain terms (`aPaidOrder()`), not large literals. For anything crossing the API, use the fixture factories beside the contract in `packages/shared`, so the web suites see the same data.
- Keep each capability's test file beside the code of the layer it tests. A use case is one capability: `cancel-order.ts` → `cancel-order.test.ts`.
