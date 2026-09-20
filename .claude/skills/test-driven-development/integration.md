# Integration tests in apps/backend

A passing unit test means the logic is correct. A passing integration test means the system is wired correctly at a boundary. Keep them separate.

## Scope
- Test the boundary: data is persisted and read back, messages are published and consumed, requests and responses map correctly.
- Don't retest business rules or their edge cases; domain and use-case tests own those.
- Use the real dependency. No mocks.

| Boundary | What to check |
|---|---|
| Database | Aggregates map to and from the schema; non-trivial queries (joins, filters, aggregations); transactions and rollback; unique and foreign-key constraints; migrations apply cleanly |
| External APIs | Request shape and response mapping; timeout, retry, and error handling |
| Message queues | Payload and routing on publish; processing and acknowledgement on consume; dead-letter routing |

## Conventions
- Name files `*.integration.test.ts` after the capability (`order-persistence.integration.test.ts`) and keep them beside the adapter they test in `infrastructure/`.
- Each test creates the data it needs with the domain factories (`aPaidOrder()`) and resets state in `beforeEach`, so tests pass in any order.
- Read connection settings from the app's Zod-parsed env config, defaulting to the Compose ports for local runs.
- Run all: `yarn workspace backend test:integration`. One file: `yarn workspace backend vitest run --config vitest.integration.config.ts <path>`. Both need Docker running.
- The Stop hook runs only unit tests. Run the integration tests yourself before finishing any change to `infrastructure/`.

## Setup (once per project)
Docker Compose runs the infrastructure, started once by Vitest's `globalSetup`, so test files never manage containers and the same Compose file serves local runs and CI.

1. `docker-compose.integration.yml` at the repo root. Give every service a healthcheck:
   ```yaml
   services:
     postgres:
       image: postgres:17
       environment:
         POSTGRES_PASSWORD: test
       ports:
         - "5433:5432"   # not 5432, so it doesn't clash with a local Postgres
       healthcheck:
         test: ["CMD", "pg_isready", "-U", "postgres"]
         interval: 2s
         retries: 15
   ```
2. `apps/backend/test/integration-setup.ts` (add `test` to the api tsconfig `include`). `--wait` blocks until every healthcheck passes; it needs Compose v2 (`docker compose`, not `docker-compose`):
   ```ts
   import { execSync } from "node:child_process";
   import { resolve } from "node:path";

   const composeFile = resolve(import.meta.dirname, "../../../docker-compose.integration.yml");

   export function setup(): void {
     execSync(`docker compose -f ${composeFile} up -d --wait`, { stdio: "inherit" });
   }

   export function teardown(): void {
     // Locally, leave containers running so the next run starts fast.
     if (process.env["CI"]) execSync(`docker compose -f ${composeFile} down`, { stdio: "inherit" });
   }
   ```
3. `apps/backend/vitest.integration.config.ts`:
   ```ts
   import { fileURLToPath } from "node:url";
   import { defineConfig } from "vitest/config";

   export default defineConfig({
     resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
     test: {
       include: ["src/**/*.integration.test.ts"],
       globalSetup: ["./test/integration-setup.ts"],
       testTimeout: 30_000,
     },
   });
   ```
4. Exclude integration tests from the unit run in `apps/backend/vitest.config.ts`, because the default `include` also matches `*.integration.test.ts`:
   ```ts
   import { fileURLToPath } from "node:url";
   import { configDefaults, defineConfig } from "vitest/config";

   export default defineConfig({
     resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
     test: { exclude: [...configDefaults.exclude, "**/*.integration.test.ts"] },
   });
   ```
5. Scripts in `apps/backend/package.json`:
   ```json
   "test": "vitest run",
   "test:integration": "vitest run --config vitest.integration.config.ts"
   ```
