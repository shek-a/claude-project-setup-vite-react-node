---
paths:
  - "apps/backend/**/*.ts"
---

# Backend architecture (DDD, hexagonal)

Each bounded context lives in `apps/backend/src/<context>/`:
- `domain/`: aggregates, entities, value objects, domain services, domain events, repository interfaces. Pure TypeScript; no framework, database, or HTTP imports (ESLint enforces this).
- `application/`: one use case per class or function. Loads aggregates through repository interfaces, calls domain methods, saves, publishes events.
- `infrastructure/`: repository implementations, external service adapters.
- `http/`: route handlers only: parse input with the shared Zod schema, call one use case, map the result to an HTTP response.

Rules:
- Dependencies point inward: http → application → domain. Infrastructure implements interfaces defined in domain/application.
- Invariants are enforced inside the aggregate. State changes only through aggregate methods named after domain operations; no public setters. Code outside the aggregate never holds references to objects inside it.
- One aggregate per transaction. When an operation must also change a second aggregate, that change reacts to a domain event; eventual consistency between aggregates is intended.
- Domain events are named in the past tense (`CarReturnedLate`) and raised by the aggregate root.
- Names the outside world depends on (event names, queue and topic names, header names, cache-key prefixes, job names) are defined once in the context that owns them; publishers and subscribers import the same constant instead of retyping the string.
- Entities are equal when their IDs are equal. Value objects have no ID, are equal when all their attributes are equal, are immutable, and validate themselves on creation.
- A rule that spans several aggregates, or belongs to none of them, goes in a stateless domain service in `domain/` (e.g. `RentalEligibility`). It takes aggregates as arguments and does no I/O; the use case loads them and passes them in. Never put such rules in a use case or handler. A domain service is a last resort: behavior that fits on an entity belongs there, or the model turns anemic.
- One repository per aggregate root, returning fully constructed aggregates, never ORM models or raw rows. Other contexts reference an aggregate by ID, never by object.
- A context's public interface is its `index.ts`: the use cases and queries other contexts may call, the DTOs they take and return, and the domain events it publishes. It never exports aggregates or entities. Other contexts import only that file, never its `domain/`, `application/`, `infrastructure/`, or `http/` (ESLint enforces this). Only the composition root that wires the app together may import internals.
- Each context owns its data. Never read or write another context's tables; call its interface or react to its events.
- Secrets (database URLs, API keys, signing keys) come from the platform's environment, never from a committed file. Never log the parsed config or return it in an error response.
- Call another context's interface for a command (the caller needs the result now and owns the decision); publish an event for a reaction. Two contexts never depend on each other in both directions. Translate another context's DTOs into your own terms at the boundary.
