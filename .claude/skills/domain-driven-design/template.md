# <Context name>

## Purpose
One paragraph: what this context is responsible for and what it is not.

Subdomain: core | supporting | generic

## Ubiquitous language
| Term | Meaning | Not to be confused with |
|---|---|---|

## Aggregates
### <Aggregate>
- Identity:
- Invariants (always true):
- Operations (commands it accepts):
- Domain events it raises:

## Value objects
| Name | Validation rules |
|---|---|

## Use cases
| Use case | Actor | Endpoint (contract) | Input schema | Result / errors |
|---|---|---|---|---|

## Public interface
Other contexts use this context only through `apps/backend/src/<context>/index.ts`, which exports use cases and DTOs, never aggregates or entities.
- Exposes (use cases and queries, with the DTOs they take and return):
- Publishes (domain events, past tense):

| Other context | Upstream or downstream | Command or event | Conform or translate |
|---|---|---|---|

## Test list
- Domain:
- Application:
- Frontend:

## Out of scope
