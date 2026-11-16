# Domain documents

One document per bounded context, named after the context (`rentals.md`, `billing.md`). Each is the agreed model for that part of the business, and the source of the words used in code, tests and UI copy.

`context-map.md` is the one diagram of how the contexts fit together: each context's published use cases, the endpoints the webapp calls, the calls between contexts, and the events they publish and consume. It is created with the first context.

## What a document contains

Written from [`.claude/skills/domain-driven-design/template.md`](../../.claude/skills/domain-driven-design/template.md):

- **Purpose and subdomain** — what the context is responsible for, what it is not, and whether it is core, supporting or generic.
- **Ubiquitous language** — each term, its meaning, and what it is not to be confused with.
- **Aggregates** — identity, invariants that must always hold, the operations they accept, and the events they raise.
- **Value objects** and their validation rules.
- **Use cases** — actor, endpoint, input schema, result and errors.
- **Public interface** — what this context exposes to others, what it publishes, and the direction of each integration.
- **Test list** — the behaviors to build, as test names.
- **Out of scope.**

## How these documents are used

- **Writing them:** run `/grill-me <the requirement>`, which interviews you and writes a requirements brief in `docs/requirements/`. Then `/implement <brief>` writes or updates the context map and the documents (including the contract design and the test list) from it, and stops once for your review before any code is written.
- **Building from them:** after your review, `/implement` works through the test list one behavior at a time with the `test-driven-development` skill, runs the suites the Definition of done requires and the `code-reviewer`, then commits. To build items that are already designed, run `/implement docs/domain/<context>.md [items]`.
- **Reviewing against them:** the `code-reviewer` agent checks that the code does what the document says and uses its terms.

Keep a document current with the code. When a change alters a business rule, update the document in the same change; the reviewer flags code that contradicts it.
