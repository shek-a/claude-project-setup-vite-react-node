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
- Read connection settings from the backend's Zod-parsed env config, with the committed `apps/backend/.env.test` pointing at the `app_test` database on the Compose port; CI uses the same file and the same Compose services.
- Run all: `yarn workspace backend test:integration`. One file: `yarn workspace backend vitest run --config vitest.integration.config.ts <path>`. Both need Docker running.
- The Stop hook runs only unit tests. Run the integration tests yourself before finishing any change to `infrastructure/`.

## Two databases, one container
Local development and the tests share one Postgres container but never a database, because the tests delete data:

| Database | Used by | Data |
|---|---|---|
| `app_dev` | `yarn workspace backend dev` | Yours: survives restarts; `seed:dev` resets it to a sample set when you want a clean start |
| `app_test` | The integration tests and the browser journeys | Disposable: reset before each test, and by `yarn workspace backend seed:e2e` |

- `apps/backend/.env` names `app_dev`; the committed `apps/backend/.env.test` names `app_test`. Values already in the environment win over `.env` files, so a test command run with the test environment cannot be redirected to `app_dev` by a local file.
- Every script that deletes data checks the database name first and refuses otherwise: the integration setup and `seed:e2e` require a name ending in `_test`, and `seed:dev` one ending in `_dev`.

## Setup (once per project)
Docker Compose runs the infrastructure, started once by Vitest's `globalSetup`, so test files never manage containers and the same Compose file serves local runs and CI.

1. `docker-compose.integration.yml` at the repo root. Give every service a healthcheck:
   ```yaml
   services:
     postgres:
       image: postgres:17
       environment:
         POSTGRES_PASSWORD: postgres
         POSTGRES_DB: app_dev   # created on first start: local development data
       ports:
         - "5433:5432"   # not 5432, so it doesn't clash with a local Postgres
       volumes:
         - postgres-data:/var/lib/postgresql/data   # development data survives `docker compose down`
         - ./docker/postgres/create-test-database.sql:/docker-entrypoint-initdb.d/create-test-database.sql:ro
       healthcheck:
         test: ["CMD", "pg_isready", "-U", "postgres", "-h", "127.0.0.1"]   # TCP, so it waits out the init scripts
         interval: 2s
         retries: 15
   volumes:
     postgres-data:
   ```
   `docker/postgres/create-test-database.sql` holds one line, `CREATE DATABASE app_test;`. Postgres runs init scripts only when its volume is empty, so on an existing volume create it once by hand: `docker compose -f docker-compose.integration.yml exec postgres createdb -U postgres app_test`.
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
   import { loadEnv } from "vite";
   import { defineConfig } from "vitest/config";

   export default defineConfig({
     resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
     test: {
       env: loadEnv("test", import.meta.dirname, ""),   // apps/backend/.env.test into process.env
       include: ["src/**/*.integration.test.ts"],
       globalSetup: ["./test/integration-setup.ts"],
       setupFiles: ["./test/refuse-non-test-database.ts"],
       testTimeout: 30_000,
     },
   });
   ```
   The guard in `setupFiles`:
   ```ts
   // test/refuse-non-test-database.ts: a setup file, so it runs before any test can delete data
   const databaseName = new URL(process.env["DATABASE_URL"] ?? "postgres://unset/").pathname.slice(1);
   if (!databaseName.endsWith("_test")) {
     throw new Error(`Integration tests delete data, so they run only against a *_test database; DATABASE_URL names "${databaseName}".`);
   }
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
