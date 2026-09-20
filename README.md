<!-- Template: replace every <placeholder> with this project's details, then delete this comment. -->

# \<Product name\>

\<One paragraph: what the product does, who uses it, and the problem it solves.\>

The business domain is documented per bounded context in [`docs/domain/`](docs/domain/): each file holds that context's glossary, aggregates and rules. Read the one you're working in before changing code; the terms there are the terms used in the code, the tests and the UI.

## Tech stack

| Part | What it is |
|---|---|
| `apps/webapp` | React + TypeScript on Vite. TanStack Query for server state, Tailwind 4 for styling, organised by user capability (`src/features/`) with shared domain pieces in `src/domains/` |
| `apps/backend` | Node + TypeScript. The business logic: one folder per bounded context, each with `domain/`, `application/`, `infrastructure/` and `http/`. Postgres for persistence |
| `packages/shared` | The API contract both apps bind to: endpoint declarations, Zod schemas, branded IDs and test fixtures |
| Tooling | Yarn workspaces, strict `tsconfig.base.json`, ESLint (flat config, with architecture boundaries, React and Tailwind rules), Vitest, React Testing Library, MSW, Playwright, Docker Compose |

## Prerequisites

- **Node 24** (the LTS line), pinned in `.nvmrc`: `nvm use`
- **Yarn** via Corepack: `corepack enable`
- **Docker Desktop**, for the integration and end-to-end suites

## Getting started

```bash
yarn install                                   # root only, never inside an app

cp apps/backend/.env.example apps/backend/.env # fill in any values marked as required
cp apps/webapp/.env.example apps/webapp/.env

docker compose -f docker-compose.integration.yml up -d --wait   # Postgres (same file the test suites use)
yarn workspace backend migrate
```

Then start both apps, in two terminals:

```bash
yarn workspace backend dev    # <http://localhost:3000>
yarn workspace webapp dev     # <http://localhost:5173>
```

Each app reads its configuration from environment variables, parsed once at startup. A missing variable fails immediately and names itself, so a boot error usually means a value is missing from your `.env`.

## Running the apps

| Command | What it does |
|---|---|
| `yarn workspace <app> dev` | Runs one app in watch mode |
| `yarn workspace <app> build` | Production build |
| `yarn workspace <app> typecheck` | TypeScript, no emit |
| `yarn eslint .` | Lints the whole repo (editors and the Claude hooks do this per file) |

## Testing

Each layer answers a different question. Run the first two constantly; the rest when you touch what they cover.

**Unit and component tests** — is the logic right?

```bash
yarn workspace backend test         # domain, use cases, HTTP handlers (with repositories mocked)
yarn workspace webapp test          # components and flows, with MSW at the network boundary
yarn workspace <app> vitest run <path>   # a single file
```

**Backend integration tests** — does the boundary work? Repositories and adapters against real Postgres, started by Docker Compose. Needs Docker.

```bash
yarn workspace backend test:integration
```

**Stubbed browser journeys** — does the app hold together in a real browser? Playwright drives the real UI with the API stubbed by MSW, so failures are deterministic and error states are easy to drive.

```bash
yarn workspace webapp test:ui
```

**Full-stack journey** — does the whole thing actually work end to end? Browser → frontend → HTTP → backend → Postgres, with nothing mocked in between. This is the suite that catches the frontend and backend drifting apart. Needs Docker. Playwright's setup starts Postgres, runs `migrate`, then `seed:e2e`, so the journey begins from a known state.

```bash
yarn workspace webapp test:e2e
```

## Project layout

```
apps/
├── backend/
│   └── src/
│       └── <context>/          # one bounded context, e.g. rentals/
│           ├── domain/         # aggregates, value objects, domain services, events, repository interfaces
│           ├── application/    # use cases
│           ├── infrastructure/ # repository implementations, adapters
│           ├── http/           # route handlers
│           └── index.ts        # the context's public interface
└── webapp/
    └── src/
        ├── features/<capability>/   # one user journey: model/, application/, api/, ui/, index.ts
        ├── domains/<context>/       # domain pieces several features share
        ├── ui/                      # generic design-system kit
        ├── testing/                 # render helper, MSW handlers
        └── config.ts                # the parsed environment
packages/
└── shared/
    └── src/<context>/          # the API contract: endpoints, schemas, fixtures
docs/
└── domain/                     # one document per bounded context
```

Both apps have a `src/` folder: the tree above shows one bounded context inside the backend's, and the feature folders inside the webapp's. The backend's layers point inward (`http/` → `application/` → `domain/`, with `infrastructure/` implementing interfaces the domain defines), and ESLint enforces that, along with contexts and features only importing each other through their `index.ts`.

## How this project works with Claude Code

The repo is set up so Claude follows the same conventions you do:

- **`CLAUDE.md`** — the standing instructions: commands, workflow, architecture.
- **`.claude/rules/`** — always-on rules, loaded for the files they apply to (TypeScript, React, Tailwind, backend architecture, the API contract).
- **`.claude/skills/`** — the workflows: `domain-driven-design` before new features, `frontend-domain-modeling` for new UI capabilities, `test-driven-development` for all production code, and `coding-standards` for worked examples.
- **`.claude/hooks/`** — the gates: ESLint runs after every edit, and a turn can't end with failing typechecks or tests.
- **`.claude/agents/code-reviewer.md`** — reviews a diff against the domain documents and the rules.

Reading `CLAUDE.md` and the rules is also the fastest way for a person to learn the conventions of this codebase.
