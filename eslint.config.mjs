// Root flat config: one ESLint setup for the whole monorepo.
// The lint hook runs this on every edited file; per-app rules are scoped with `files`.
// Root devDependencies: eslint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react,
// eslint-plugin-better-tailwindcss, eslint-plugin-boundaries, eslint-import-resolver-typescript.
// eslint-plugin-react 7.37 declares ESLint <=9 as its peer; its rules used here work on ESLint 10 (Yarn warns, npm needs --legacy-peer-deps).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import tailwind from "eslint-plugin-better-tailwindcss";
import boundaries from "eslint-plugin-boundaries";

// Apps import their own modules through the @/ alias. Every no-restricted-imports block under apps/ must include this
// pattern, because a later block's options replace an earlier block's instead of merging.
const noRelativeImports = { regex: "^\\.{1,2}/", message: "Import app modules through the @/ alias, not relative paths." };
const noFunctionComponentType = { message: "Type props directly: function Button({ label }: ButtonProps)." };
const noEnums = { selector: "TSEnumDeclaration", message: "No enums: use an as const array or a Zod enum." };
const noDirectEnvAccess = [
  {
    selector: 'MemberExpression[object.name="process"][property.name="env"]',
    message: "Read the environment only in src/config.ts, through its Zod schema; import the parsed config elsewhere.",
  },
  {
    selector: 'MemberExpression[object.type="MetaProperty"][property.name="env"]',
    message: "Read the environment only in src/config.ts, through its Zod schema; import the parsed config elsewhere.",
  },
];
const noCrossAppImports = (otherApp) => ({
  group: [`**/apps/${otherApp}/**`],
  message: "Apps never import each other: share through packages/shared.",
});

// Boundary policies are last-match-wins: an element reaches others only through index.ts,
// and a later policy re-allows imports within the same element.
const throughIndexOnly = (fromTypes, toTypes, message) => ({
  from: { element: { type: fromTypes } },
  disallow: { to: { element: { type: toTypes, fileInternalPath: "!index.{ts,tsx}" } } },
  message,
});
const withinSameElement = (type) => ({
  from: { element: { type } },
  allow: { to: { element: { type, captured: { name: "{{ from.element.captured.name }}" } } } },
});
const never = (fromType, toTypes, message) => ({
  from: { element: { type: fromType } },
  disallow: { to: { element: { type: toTypes } } },
  message,
});

export default tseslint.config(
  { ignores: ["**/dist/**", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    // Shared: mechanical proxies for single responsibility and one level of abstraction
    rules: {
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
      "max-depth": ["error", 2],
      "max-params": ["error", 3],
      complexity: ["error", 8],
      "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Shared: TypeScript conventions enforced here instead of written as prose rules
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "no-restricted-syntax": ["error", noEnums],
    },
  },
  {
    // Backend and shared contracts: exported functions declare their return types
    files: ["apps/backend/**/*.ts", "packages/**/*.ts"],
    rules: { "@typescript-eslint/explicit-module-boundary-types": "error" },
  },
  {
    // Apps: import your own modules through @/ (packages keep relative imports; @/ would resolve against the consuming app),
    // and never reach into the other app
    files: ["apps/webapp/src/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [noRelativeImports, noCrossAppImports("backend")] }] },
  },
  {
    files: ["apps/backend/src/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [noRelativeImports, noCrossAppImports("webapp")] }] },
  },
  {
    // Frontend only
    files: ["apps/webapp/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, react },
    settings: { react: { version: "19.0" } }, // explicit: "detect" calls context.getFilename(), which ESLint 10 removed
    rules: {
      ...reactHooks.configs.recommended.rules,
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }], // JSX is verbose
      "react/function-component-definition": ["error", { namedComponents: "function-declaration", unnamedComponents: "arrow-function" }],
      "react/no-array-index-key": "error",
      "react/jsx-key": "error",
      "@typescript-eslint/no-restricted-types": ["error", { types: {
        "React.FC": noFunctionComponentType, FC: noFunctionComponentType,
        "React.FunctionComponent": noFunctionComponentType, FunctionComponent: noFunctionComponentType,
      } }],
    },
  },
  {
    // Backend domain layer must stay pure
    files: ["apps/backend/src/*/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [noRelativeImports, noCrossAppImports("webapp"), {
          group: ["express", "fastify", "@prisma/*", "drizzle-orm*", "**/infrastructure/**", "**/http/**", "**/application/**"],
          message: "The domain layer must not depend on frameworks, infrastructure, or outer layers.",
        }],
      }],
    },
  },
  {
    // Bounded contexts (api), features, and shared domains (web) talk to each other only through their index.ts;
    // shared domains never depend on features, and the generic ui kit depends on neither.
    files: ["apps/*/src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/root-path": import.meta.dirname,
      "import/resolver": {
        typescript: { project: `${import.meta.dirname}/{apps,packages}/*/tsconfig.json`, noWarnOnMultipleProjects: true },
      },
      "boundaries/elements": [
        { type: "context", pattern: "apps/backend/src/*", capture: ["name"] },
        { type: "feature", pattern: "apps/webapp/src/features/*", capture: ["name"] },
        { type: "domain", pattern: "apps/webapp/src/domains/*", capture: ["name"] },
        { type: "ui-kit", pattern: "apps/webapp/src/ui" },
      ],
    },
    rules: {
      "boundaries/dependencies": ["error", {
        default: "allow",
        policies: [
          throughIndexOnly("context", "context", "Import another context only through its index.ts."),
          withinSameElement("context"),
          throughIndexOnly(["feature", "domain"], ["feature", "domain"], "Import another feature or shared domain only through its index.ts."),
          withinSameElement("feature"),
          withinSameElement("domain"),
          never("domain", "feature", "A shared domain never depends on a feature."),
          never("ui-kit", ["feature", "domain"], "src/ui is the generic kit; code that imports a domain concept belongs in a feature or shared domain."),
          // Apps never import each other, however the import is spelled: boundaries resolves it to a file first
          never("context", ["feature", "domain", "ui-kit"], "The API must not import the web app; share through packages/shared."),
          never(["feature", "domain", "ui-kit"], "context", "The web app must not import the API; share through packages/shared."),
        ],
      }],
    },
  },
  {
    // Only the config module reads the environment; test setup files may too
    files: ["apps/*/src/**/*.{ts,tsx}"],
    ignores: ["apps/*/src/config.ts", "apps/*/src/testing/**"],
    rules: { "no-restricted-syntax": ["error", noEnums, ...noDirectEnvAccess] },
  },
  {
    // Tailwind: canonical class order; no conflicting, duplicate, unknown, or deprecated classes;
    // no class names built dynamically; theme tokens instead of arbitrary values
    files: ["apps/webapp/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": tailwind },
    settings: {
      "better-tailwindcss": {
        cwd: `${import.meta.dirname}/apps/webapp`,
        entryPoint: `${import.meta.dirname}/apps/webapp/src/index.css`, // the CSS file with @import "tailwindcss" and @theme
      },
    },
    rules: {
      "better-tailwindcss/enforce-consistent-class-order": "error",
      "better-tailwindcss/enforce-canonical-classes": "error",
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-unknown-classes": "error",
      "better-tailwindcss/no-deprecated-classes": "error",
      "better-tailwindcss/no-unnecessary-whitespace": "error",
      "better-tailwindcss/no-concatenated-classes": "error",
      "better-tailwindcss/no-restricted-classes": ["error", { restrict: [{
        pattern: "\\[[^\\]]*\\](?!:)",
        message: "Arbitrary value: use a theme token, adding it to @theme in the CSS entry file if it belongs to the design.",
      }] }],
    },
  },
  {
    // Frontend model stays pure: no React, no server-state library, no other layers
    files: ["apps/webapp/src/{features,domains}/*/model/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [noRelativeImports, noCrossAppImports("backend"), {
          group: ["react", "react-dom", "@tanstack/*", "**/api/**", "**/application/**", "**/ui/**"],
          message: "A feature's model/ is pure TypeScript: no React, no query library, and no api/, application/, or ui/.",
        }],
      }],
    },
  },
  {
    // Tooling config and plain JS usually sit outside every tsconfig, so lint them without type information.
    // Any other .ts file must be in a tsconfig `include`; the lint hook says so when one is missing.
    files: ["**/*.{js,mjs,cjs}", "**/*.config.{ts,mts,cts}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: { "max-lines-per-function": "off", "max-lines": "off" },
  },
);
