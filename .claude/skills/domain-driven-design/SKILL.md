---
name: domain-driven-design
description: Models the business domain and derives the module structure from it (subdomains, bounded contexts, context interfaces, ubiquitous language, invariants, aggregates, entities, value objects, domain events), then the API contract and the TDD test list. Use before writing code for any new capability or domain concept; when deciding where a concept or rule belongs, naming domain types, or defining aggregate boundaries; when reviewing whether business logic has leaked into handlers or persistence; and whenever the user mentions domain modelling, bounded contexts, aggregates, entities, or value objects, or asks how the project should be organised.
---

# Domain-driven design

Use this to decide **where things belong** and **what they are called**. It governs structure and naming; the `test-driven-development` skill governs how the code inside that structure gets written. Do not write production code in this skill. The output is a reviewed `docs/domain/<context>.md`.

## Workflow

Work in this order. Later steps depend on earlier ones: aggregates derived before the language is settled are built on the wrong nouns.

1. **Read what exists.** Read `docs/domain/*.md` for the current contexts and their language.
2. **Capture the language.** Interview the user with the AskUserQuestion tool about the business, not the technology: rules, edge cases, what can go wrong, who triggers each action, and the words they use. Where two terms look synonymous, ask which one the business says. Keep going until the invariants are clear. The result is the naming authority for everything after.
3. **Classify the subdomain** as core, supporting, or generic. This sets how much modelling it deserves.
4. **Place the work in a bounded context.** Decide whether it belongs to an existing context or needs a new one, and explain why. Draw boundaries around business capabilities (what the business does: rentals, fleet, billing), not around entities, database tables, or technical layers.
5. **Define the context's interface**: the use cases it publishes, the DTOs they speak, which contexts are upstream and downstream, and whether each integration is a command or a reaction.
6. **List the invariants**: the rules that must never be violated ("a car cannot be rented to two customers over the same period", "a rental cannot end before it starts").
7. **Derive aggregates from the invariants**, then classify each type as entity or value object. Do not start by drawing boxes around nouns.
8. **Write or update `docs/domain/<context>.md`** from [template.md](template.md). Note which terms and published DTOs the frontend will show. Frontend features follow user capabilities, not contexts; model them with the `frontend-domain-modeling` skill.
9. **Derive the contract**: the endpoint declarations to add to `packages/shared/src/<context>/contract.ts` (method, path, request, response, error union with each error's HTTP status, branded IDs) and a fixture factory per response. Both apps bind to these; see `.claude/rules/contract.md`.
10. **Derive the test list**: behaviors as test names for domain, application, and frontend. This is the backlog for the `test-driven-development` skill.
11. **Stop and ask the user to review the document** before any implementation starts. Modelling decisions are expensive to reverse and cheap to discuss.

## Strategic design

### Subdomains: core, supporting, generic

Not every part of the system deserves the same investment. Classify before modelling:

- **Core**: what differentiates the business. Rich models, careful language, full tactical DDD. Spend the effort here.
- **Supporting**: necessary but not differentiating. Model it simply; a use case and some plain types is usually enough.
- **Generic**: solved problems (auth, notifications, audit, file storage). Buy or use a library. Do not build an elegant domain model for these.

Applying full DDD uniformly across the whole application is the most common way the approach becomes a net cost.

### Bounded contexts

A bounded context is the boundary within which a term has exactly one meaning. When the same word means different things to different parts of the business, that is the signal for a boundary, not a reason to reconcile them into one model.

A `Car` in a rentals context (is it available, what does it cost) is not the same as a `Car` in a maintenance context (service history, mileage, defects). Forcing one shared `Car` class produces a type that serves neither well and grows a field for every use.

**Contexts map to top-level modules** in `apps/backend/src/`. (The frontend organizes by user capability, with a shared domain folder per context for pieces several features reuse; see the `frontend-domain-modeling` skill.)

```
apps/backend/src/
  rentals/          # bounded context
    domain/         # aggregates, entities, value objects, domain services, events, repository interfaces
    application/    # use cases orchestrating the domain
    infrastructure/ # repository implementations, external clients
    http/           # route handlers
    index.ts        # the context's entire public interface
  fleet/
  billing/
  shared-kernel/    # only for genuinely shared concepts; keep small. Imported through its index.ts like any context
```

### Context integration

Contexts never reach into each other. Each one exposes a narrow, explicit interface and everything outside it is internal.

**The interface is the application layer, not the domain layer.** It exposes use cases (`openAccount`, `closeAccount`, `findAccountSummary`), not entities. If another context can import `Account`, the two are coupled to one model and every change to the aggregate ripples outward.

```ts
// accounts/index.ts: the entire public surface of this context
export interface AccountsApi {
  openAccount(command: OpenAccountCommand): Promise<Result<AccountSummary, OpenAccountError>>;
  closeAccount(command: CloseAccountCommand): Promise<Result<void, CloseAccountError>>;
  findAccountSummary(id: AccountId): Promise<AccountSummary | null>;
}

export type { OpenAccountCommand, CloseAccountCommand, AccountSummary } from "@/accounts/application/published-language";
export type { AccountOpened } from "@/accounts/domain/events";
```

**The interface speaks its own published language, not domain objects.** `AccountSummary` is a flat DTO built for consumers; it is not the `Account` aggregate. Returning the aggregate leaks the model exactly as badly as importing it, and freezes the internal design against every caller.

**Consumers translate on the way in.** A context receiving `AccountSummary` maps it to its own terms at the boundary rather than letting a foreign concept spread inward. The same applies, more strongly, to external and legacy systems.

**Commands call the interface; reactions subscribe to events.**

- Call the interface when the caller needs a result now and owns the decision. Opening an account during rental signup is a command: call it.
- Publish an event when another context should react on its own terms. Sending a welcome message after `AccountOpened` is a reaction: the accounts context must not know that notifications exist.

Getting this backwards produces contexts that depend on each other in both directions, which is the failure mode the boundaries were drawn to prevent.

**Tooling enforces the boundary.** `eslint-plugin-boundaries` in `eslint.config.mjs` makes any import of another context other than its `index.ts` a lint error. Lint cannot see an `index.ts` that exports an aggregate or entity; the `code-reviewer` checks that.

**Direction of dependency is a decision.** When two contexts integrate, name which is upstream and which is downstream, and record it in the doc's Public interface section. A downstream context either conforms to the upstream language or wraps it in a translation layer; drifting between the two without deciding is how the boundary erodes.

## Ubiquitous language

Use domain terms consistently across code, tests, conversation, and documentation. When a concept has a business name, that exact name appears in type names, method names, and variables: not synonyms, not technical abbreviations.

**Violation:**

```ts
function addVehicleToUser(vehicleId: string, userId: string) { ... }
```

**Fix:**

```ts
function reserveCarForCustomer(carId: CarId, customerId: CustomerId) { ... }
```

Generic verbs are a symptom of a missing concept. `updateStatus` usually means something more specific the business has a word for: `returnCar`, `cancelRental`, `markOffFleet`. When the code needs a verb the business does not use, that is a question to ask, not a gap to fill with a technical term.

This language carries directly into test names. A test reading *"denies rental when customer has overdue returns"* is only possible if the domain types are named the way the business speaks.

## Aggregates

An **aggregate** is a consistency boundary: a cluster of objects that must be valid together, changed together, and saved together. The **aggregate root** is the only entry point; external code never holds references to objects inside it.

### Rules for aggregate design

- **Derive the aggregate from the invariant.** If two pieces of data must be consistent within a single transaction, they belong in one aggregate. If they do not, they do not.
- **Keep aggregates small.** Most aggregates are a root plus a few value objects. A root holding a large collection is a design smell: it forces loading everything to change anything, and creates contention.
- **Reference other aggregates by ID, not by object reference.** A booking holds `customerId`, not a `Customer`.
- **One aggregate per transaction.** If an operation must modify two aggregates, either the boundary is wrong, or the second change should happen asynchronously via a domain event.
- **Accept eventual consistency across aggregates.** This is a deliberate trade, not a defect.

### Worked reasoning

The invariant "a car cannot be rented to two customers over the same period" must hold at the moment a booking is made. The objects involved in that check are the proposed period and the car's other upcoming bookings: not the customer's profile, and not the car's service history (that belongs to the maintenance context's `Car`).

So the aggregate is the rentals context's `Car`. It holds its upcoming bookings as `Booking` value objects (`customerId` and a `RentalPeriod`) and accepts `book(customerId, period)`. `Customer` is a separate aggregate with its own lifecycle and invariants, referenced by ID. `Car` stays small by holding only upcoming bookings; past ones are history, not part of the invariant.

Two tempting alternatives fail the rules above:

- Making `Customer` the root and hanging cars off it makes the aggregate unboundedly large, and a car plainly has a life independent of any one customer.
- Making each rental its own aggregate and checking for overlap inside it cannot work: the rule spans many rentals, and an aggregate can only guarantee what is inside its own boundary.

**Violation:**

```ts
await CarModel.findByIdAndUpdate(carId, { customerId });
```

Persistence is being driven directly, so no invariant is enforced anywhere.

**Fix:** change state through the aggregate root, which enforces the rule, then save the aggregate:

```ts
const car = await carRepository.findById(carId);
const booking = car.book(customerId, period); // Result<Booking, CarUnavailable>; raises CarBooked
if (booking.ok) await carRepository.save(car);
return booking;
```

## Entities vs value objects

**Entities** have identity that persists over time: equality is by ID, not attributes. **Value objects** have no identity: equality is by attributes, and they are immutable.

Default to value objects. They are simpler, safely shareable, and carry validation.

```ts
// Entity: the same customer even after every attribute changes
class Customer {
  constructor(readonly id: CustomerId, private name: CustomerName) {}
}

// Value object: two equal periods are interchangeable, and it validates itself
class RentalPeriod {
  private constructor(readonly start: Date, readonly end: Date) {}

  static create(start: Date, end: Date): Result<RentalPeriod, InvalidRentalPeriod> {
    if (end <= start) return err({ kind: "rental_ends_before_it_starts", start, end });
    return ok(new RentalPeriod(start, end));
  }

  overlaps(other: RentalPeriod): boolean { ... }
}
```

### Make invalid states unrepresentable

Put validation in a factory so an instance cannot exist in an invalid state. A value object that can be constructed invalid pushes validation out to every call site, where it will eventually be forgotten. Expected failures come back as a `Result`, never a throw.

Identifiers are branded types, defined once with Zod in `packages/shared` so they cannot be transposed and are only obtained by parsing:

```ts
export const CustomerIdSchema = z.uuid().brand<"CustomerId">();
export type CustomerId = z.infer<typeof CustomerIdSchema>;
```

This is the difference between a compile error and a production bug when arguments get swapped.

## Domain services

Logic that does not naturally belong to a single entity or value object belongs in a **domain service**. Domain services are stateless and operate on domain objects.

Use one when:

- the operation genuinely spans multiple aggregates
- the logic would feel contrived on any single entity

Examples: `RentalEligibility`, `Pricing`.

**Reach for this last, not first.** A domain service is the fallback when behavior has no natural home, not the default location for business logic. Logic that could live on an entity but was put in a service produces an anemic domain model: entities reduced to property bags while all behavior sits in stateless services. If every entity in a context is data-only, the model is anemic and the behavior should be moved back.

## Repositories

Repositories abstract persistence and speak the language of the domain: collections of aggregate roots, not rows or documents.

- **One repository per aggregate root.** Not one per table, not one per entity.
- The interface is defined in the domain layer; the implementation lives in infrastructure. The domain depends on the interface, never the ORM.
- Return fully constructed domain objects, never ORM models or raw records.

```ts
// bad: infrastructure leaking into domain callers
const customer = await CustomerModel.findById(id).populate("rentals");

// good
const customer = await customerRepository.findById(id);
```

## Layering

```
http/  →  application/  →  domain/  ←  infrastructure/ (implements the domain's repository interfaces)
```

Dependencies point inward. The domain layer imports nothing from infrastructure or delivery: no ORM types, no HTTP types, no framework decorators on domain objects (ESLint enforces this).

Route handlers translate between HTTP and the domain and delegate immediately. Business rules never live there. Use cases orchestrate (load an aggregate, call a method on it, save it) and hold no business rules of their own.

## Domain events

When something meaningful happens, model it explicitly rather than hiding the side effect inside a mutation. Name events in past tense, using domain language.

```ts
class CarReturnedLate {
  constructor(
    readonly rentalId: RentalId,
    readonly returnedAt: Date,
    readonly daysOverdue: number,
  ) {}
}
```

Raise events from the aggregate root; handlers react to them. Events are the mechanism for the "one aggregate per transaction" rule (the second aggregate reacts to the event rather than being modified in the same transaction), and they are how bounded contexts communicate without coupling.

## Where this skill stops

This skill governs structure and naming. It stops at the point where code gets written, and the `test-driven-development` skill takes over. Knowing where the seam falls matters, because modelling that runs on past it silently replaces TDD with up-front design.

**Decide here, before any test exists:** subdomain classification, bounded contexts, context interfaces and their published language, ubiquitous language, aggregate boundaries and the invariants they enforce. These are structural, expensive to reverse, and no failing test will reveal them.

**Do not decide here; let these emerge through red-green-refactor:** method signatures, whether a rule sits on the entity or in a domain service, how collaborators are split, the internal structure of an aggregate. This is the design pressure TDD exists to apply, and pre-empting it wastes the cycle.

**The stop signal:** if the work has moved from naming things and drawing boundaries to designing method signatures or deciding how something will be implemented, the strategic work is finished. Write the test list, get the document reviewed, and hand over to the `test-driven-development` skill.

Modelling up front never licenses writing production code without a failing test.

### How the two reinforce each other

- **The aggregate is the natural unit under test.** It is a behavior boundary, which is what the `test-driven-development` skill means by testing observable behavior through public interfaces.
- **The repository and the context interface are the natural mock boundaries.** DDD identifies exactly where the external boundaries sit, which is the only place mocking is permitted.
- **Ubiquitous language makes behavioral test names possible.** Tests read as business requirements only when the types are named the way the business speaks.

## Anti-patterns

| Anti-pattern | What it means |
| --- | --- |
| Entities are data-only, all logic in services | Anemic model; move behavior onto the entities |
| An aggregate root holds a large collection | Boundary is too wide; reference by ID instead |
| One transaction modifies two aggregates | Wrong boundary, or the second should react to an event |
| Aggregate holds another aggregate by reference | Use an ID |
| A shared type serves two contexts with different meanings | Split it; one type per context |
| One context imports another's entity or aggregate | Go through the published interface |
| A context interface returns an aggregate | Return a DTO; the model is leaking |
| Two contexts depend on each other both ways | One direction should be an event, not a call |
| ORM model returned from a repository | Persistence leaking into the domain |
| `updateStatus`, `processData`, `handleRequest` | A missing domain concept; ask what the business calls it |
| Full DDD applied to auth or notifications | Generic subdomain; use a library |
| Validation at call sites rather than in factories | Invalid states are representable |
