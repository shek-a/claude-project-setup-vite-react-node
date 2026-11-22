<!-- Template: follow TEMPLATE.md to set the project up, replace every <placeholder> below with this project's details, then delete TEMPLATE.md and this comment. -->

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
│           ├── domain/         # pure TypeScript, grouped by concept once it grows:
│           │   ├── <aggregate>/    #   root, state, lifecycle operations, events, its tests
│           │   ├── value-objects/
│           │   ├── <policies>/     #   replaceable rules named as the domain names them
│           │   └── testing/        #   hand-placement builders, tests only
│           ├── application/    # use cases
│           ├── infrastructure/ # repository implementations, adapters
│           ├── http/           # route handlers
│           └── index.ts        # the context's public interface
└── webapp/
    ├── src/
    │   ├── features/<capability>/   # one user journey: model/, application/, api/, ui/, index.ts
    │   ├── domains/<context>/       # domain pieces several features share
    │   ├── ui/                      # generic design-system kit
    │   ├── testing/                 # render helper, MSW handlers
    │   └── config.ts                # the parsed environment
    ├── e2e/
    │   ├── ui/                      # Playwright journeys with the API stubbed      -> test:ui
    │   └── integrated/              # one Playwright journey against the real API  -> test:e2e
    └── playwright.config.ts         # one config, two projects: ui and integrated
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
- **`.claude/skills/`** — the workflows. A feature takes two commands: `/grill-me <the requirement>` interviews you until you share an understanding and writes the requirements, with no design, as a brief in `docs/requirements/`; `/implement <brief>` designs it (context map, domain document, contract, test list), stops once for your review, then builds it through to a reviewed commit. Underneath, `domain-driven-design` and `frontend-domain-modeling` do the modelling, `test-driven-development` governs all production code, and `coding-standards` has worked examples. `grilling` is vendored from [mattpocock/skills](https://github.com/mattpocock/skills), and `grill-me` adapted from it, under its MIT licence.
- **`.claude/hooks/`** — the gates: ESLint runs after every edit, and a turn can't end with failing typechecks or tests.
- **`.claude/agents/code-reviewer.md`** — reviews a diff against the domain documents and the rules.

### Building a feature: `/grill-me`, then `/implement`

A feature takes two commands, with one review in between. Example: customers should be able to extend a rental.

**1. `/grill-me customers can extend a rental`**

Claude reads the existing domain documents, then interviews you in rounds of numbered questions, each with a recommended answer, about the business only:

```
❓ Q1 - Overlap: can an extension overlap another booking of the same car?
➡️ No: the extension is rejected and the customer is told the car is booked.

❓ Q2 - Limit: is there a maximum extension?
➡️ Yes, 14 days in total, as the current terms say.
```

You answer ("yes", or a correction), and it asks the next round until nothing is left open and you confirm you share an understanding. It then writes the requirements, with no design, to `docs/requirements/extend-rental.md` (problem, actors, agreed terms, rules, examples with real numbers, edge cases, the user journey, what is out of scope) and ends with the next command to run.

**2. `/implement docs/requirements/extend-rental.md`**

Claude designs the change from the brief and stops once for your review, showing:
- the context map diagram (bounded contexts, what reaches them, events between them);
- what changed in each domain document, and where each rule is enforced;
- the published interfaces: the HTTP contract (endpoints, errors, statuses) and each context's interface, including the events it publishes;
- the test list, as test names, and the suites the change needs.

For this example: an `extendRental` use case in the `rentals` context with the overlap and 14-day rules as invariants of the rental, a `POST /api/rentals/:id/extension` endpoint in the shared contract, and an extend form in the webapp's `manage-rentals` feature.

Ask for changes or approve. After approval it builds each test-list item test first (red, green, refactor), runs typecheck, the unit tests, and `yarn workspace webapp test:e2e` (the contract changed), runs the `code-reviewer` and fixes or declines each finding, then makes one commit and reports what ran and what did not. It never pushes or opens a pull request; that is yours to do.

**Variations**
- **Something already designed:** `/implement docs/domain/rentals.md "rejects an extension that overlaps another booking"` builds named test-list items without a brief.
- **A trivial change** (a typo, a config value): just ask. The test-first rule and the hooks still apply.
- **A requirements gap found during design or build:** Claude stops and asks rather than inventing a rule, and records the answer in the brief.

Reading `CLAUDE.md` and the rules is also the fastest way for a person to learn the conventions of this codebase.
