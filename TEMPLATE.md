# Using this template

This repository holds the conventions for a React + Vite and Node monorepo, not an application: there is no `package.json` and no source code yet. Follow these steps once to start a project from it, then delete this file.

## Set up the project

1. Copy everything in this repository into the new project: `CLAUDE.md`, `.claude/`, `.mcp.json`, `.nvmrc`, `docs/`, `eslint.config.mjs`, `tsconfig.base.json`, `.gitignore`, and `README.md`.
2. Create the root `package.json` with Yarn workspaces:
   ```json
   { "private": true, "workspaces": ["apps/*", "packages/*"] }
   ```
3. Create the three workspaces the conventions assume:
   - `apps/webapp`: `yarn create vite apps/webapp --template react-ts`, then add Tailwind 4 and TanStack Query.
   - `apps/backend`: a Node + TypeScript package with your HTTP framework and database library of choice.
   - `packages/shared`: a TypeScript package for the API contract, depending on `zod`. Both apps add it as a dependency.
4. Make each workspace's `tsconfig.json` extend the strict base. The two apps also get the `@/` alias:
   ```jsonc
   // apps/<app>/tsconfig.json
   { "extends": "../../tsconfig.base.json", "compilerOptions": { "paths": { "@/*": ["./src/*"] } }, "include": ["src", "test", "e2e"] }
   ```
   Give Vite and Vitest the same alias (see "The @/ alias" in `.claude/skills/coding-standards/SKILL.md`).
5. Install, at the root, what `eslint.config.mjs` imports:
   ```bash
   yarn add -D -W eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react \
     eslint-plugin-better-tailwindcss eslint-plugin-boundaries eslint-import-resolver-typescript
   ```
6. Add the scripts the hooks and the workflow call. The Stop hook runs `typecheck` and `test` in every workspace that defines them:
   | Workspace | Scripts |
   |---|---|
   | `apps/backend` | `dev`, `build`, `typecheck`, `test`, `test:integration`, `migrate`, `seed:e2e` |
   | `apps/webapp` | `dev`, `build`, `typecheck`, `test`, `test:ui`, `test:e2e` |
   | `packages/shared` | `typecheck`, `test` |
7. Add the files the rules refer to:
   - `apps/<app>/src/config.ts`: the Zod-parsed environment, with an `.env.example` beside each app.
   - `apps/webapp/src/index.css`: the Tailwind entry file (`@import "tailwindcss"` and `@theme`); the ESLint config points at it.
   - The test configuration described in `.claude/skills/test-driven-development/`: `integration.md` (Docker Compose and the Vitest integration config), `frontend.md` (the render helper and MSW), and `playwright.md` (the `ui` and `integrated` projects).

Until a workspace's `package.json` defines `typecheck` and `test`, the Stop hook skips them for that workspace; the lint hook needs ESLint installed.

## Make it yours

1. In `README.md`, replace every `<placeholder>` and delete the template comment at the top. Its "Getting started" section describes the finished setup above; adjust it to the commands you ended up with.
2. Check the hooks run: edit any `.ts` file in a Claude Code session and confirm ESLint reports on it.
3. Delete this file.

## Then build the first feature

Run `/grill-me <the requirement>`, then `/implement <the brief it wrote>`. The README's "Building a feature" section walks through an example. The first `/implement` creates `docs/domain/<context>.md` and `docs/domain/context-map.md`.
