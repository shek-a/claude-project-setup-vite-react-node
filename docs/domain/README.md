# Domain documents

One document per bounded context, named after the context (`rentals.md`, `billing.md`). Each is the agreed model for that part of the business, and the source of the words used in code, tests and UI copy.

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

- **Writing them:** run `/domain-driven-design` before building a feature or introducing a domain concept. It interviews you about the business, writes or updates the document, and stops for your review before any code is written.
- **Building from them:** the `test-driven-development` skill works through the test list one behavior at a time.
- **Reviewing against them:** the `code-reviewer` agent checks that the code does what the document says and uses its terms.

Keep a document current with the code. When a change alters a business rule, update the document in the same change; the reviewer flags code that contradicts it.
