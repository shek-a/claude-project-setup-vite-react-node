---
name: frontend-domain-modeling
description: Models domain concepts and user workflows in the React frontend while keeping React, API DTOs, and server-state mechanics out of the domain model, covering the user capability, the backend contexts and published DTOs it uses, the frontend model, DTO mappings, the split between server, UI, and derived state, explicit user actions, and usability-only validation. Use before building a new frontend capability, and when organising frontend features or deciding where a shared domain component belongs, introducing frontend domain types, mapping API data, modelling a UI workflow, or deciding where frontend logic belongs. Do not use it to define backend aggregates, persistence, or transactional invariants; that is the domain-driven-design skill.
---

# Frontend domain modeling

Model the business language presented through the UI without duplicating the backend's authoritative domain model.

The backend owns transactional invariants. The frontend owns presentation, interaction, user intent, and client-side workflow state.

The frontend holds a **projection** of the domain. Apply DDD here to keep domain concepts explicit and decoupled from UI and transport, not to replicate the backend model. Model pragmatically: plain types and pure functions usually beat rich class hierarchies (see Apply pragmatically).

The `test-driven-development` skill governs implementation, `.claude/rules/frontend/react.md` governs React mechanics, and the `coding-standards` skill governs TypeScript. Do not write production code in this skill.

## Modeling workflow

Before implementing a new frontend capability:

1. Describe the user capability in business language.
2. Identify the backend contexts involved, and read their `docs/domain/<context>.md`.
3. Identify the representations published by those contexts: their Zod schemas in `packages/shared`.
4. Define the frontend model needed by the user journey.
5. Define mappings from transport DTOs into that model.
6. Identify server state, local UI state, and derived state.
7. Express meaningful user actions explicitly.
8. Identify validation that improves usability without treating it as authoritative enforcement.
9. Derive the test list: behaviors as test names, from the user's point of view. This is the backlog for the `test-driven-development` skill.
10. Present the model and the test list for review, and stop before implementation.

If the capability needs a backend concept or rule that doesn't exist yet, run the `domain-driven-design` skill first. This skill consumes what the backend publishes; it doesn't invent it.

Do not design component, hook, or file structure beyond what is needed to establish these boundaries. Allow implementation details to emerge through TDD.

## Ubiquitous language

Use the same business terminology as the backend and product language.

Prefer: `reserveCar`, `cancelRental`, `RentalPeriod`, `BookingRejection`.

Avoid: `handleData`, `processItem`, `updateStatus`, `submitThing`.

**Violation:**

```ts
function loadData(vehicleId: string, userId: string) { ... }
```

**Fix:**

```ts
function reserveCar(carId: CarId, customerId: CustomerId) { ... }
```

Components, test descriptions, actions, and visible labels use consistent terminology. A button labelled "Reserve car" calls `reserveCar`, and its test says so.

## Organize around user capabilities

Frontend modules normally represent user capabilities or journeys. They do not need to mirror backend bounded contexts one-to-one.

```text
apps/webapp/src/features/
├── book-rental/       # uses rentals (availability, booking) and billing (price quote)
└── manage-rentals/    # uses rentals
```

A feature may compose published data from several backend contexts, but it must not import or reproduce their internal domain models.

Expose a narrow public interface from each feature. Avoid deep imports into another feature's components, state, or API implementation; `eslint-plugin-boundaries` makes them a lint error.

### Shared domains

Some domain concepts are used by several features: the `Car` model, its mapper, a `CarCard`. Don't bury them inside one feature, and don't put them in the generic kit. Give them a shared domain folder named after the backend context that publishes them:

```text
apps/webapp/src/
├── domains/
│   └── fleet/              # shared domain
│       ├── model/          car.ts
│       ├── api/            car-mapper.ts, use-car.ts
│       ├── ui/             car-card.tsx, fleet-status-badge.tsx
│       └── index.ts
├── features/
│   ├── catalogue/          # composes fleet's pieces into a user journey
│   └── book-rental/
└── ui/                     # generic design-system kit: Button, Icon, PriceTag
```

Two axes coexist, and that's fine: a shared domain holds a context's model and domain-aware components; a feature composes them into a user journey.

**Placement test:** does the code import a domain concept (`Car`, `FleetStatus`)? Then it belongs to the feature or shared domain that owns that concept. Pure presentation with no domain import belongs in `src/ui/`.

ESLint enforces the directions: features and shared domains import each other only through `index.ts`, a shared domain never imports a feature, and `src/ui/` imports neither.

## Separate model, application, integration, and presentation

A frontend feature may contain:

```text
book-rental/
├── model/          # pure domain types and calculations
├── application/    # workflow orchestration and user actions
├── api/            # DTOs, clients, query hooks, and boundary mappers
├── ui/             # React components
└── index.ts        # public feature interface
```

| Folder | Holds | May import |
|---|---|---|
| `model/` | Types and pure calculations in the feature's language | No React, no query library, no DTO types, none of the feature's other folders (ESLint enforces the imports). Branded IDs and enums from `packages/shared` are fine |
| `application/` | Workflow orchestration and user actions, as hooks | `model/`, `api/` |
| `api/` | Clients, query hooks, and mappers; DTO types come from `packages/shared` | `model/`, `packages/shared` |
| `ui/` | Components that render | `model/`, `application/`, and `api/` query hooks, which return model types |

A shared domain uses the same folders except `application/`: workflows belong to features.

### Apply pragmatically

Don't over-model. Most frontend features need plain domain types, a few pure functions, and the API boundary, not rich aggregates, entity classes, or an event bus. A feature that only displays published data can start with `api/` and `ui/`; add `model/` and `application/` when the journey needs its own terms, calculations, or a multi-step workflow. Reach for heavier tactics only when the frontend genuinely owns complex logic, not when it is a thin projection of the backend.

## Model the domain in types

On the frontend, entities and value objects are types plus pure functions, not classes.

- **Entity:** identity persists over time; equality is by ID. IDs are branded types from `packages/shared`.
- **Value object:** no identity; equality is by value; `readonly`, so nothing mutates it in place.

```ts
interface Customer {        // entity: identity is the ID
  readonly id: CustomerId;
  name: string;
}

interface RentalPeriod {    // value object: equal when both dates are equal
  readonly start: Date;
  readonly end: Date;
}
```

## Map at the boundary

DTOs stop at `api/`. Call each endpoint through its contract in `packages/shared` (never a hand-written path or type), parse the response with `contract.response`, then map it into the feature's model at this edge (an anti-corruption layer), so API changes don't ripple through the UI and loose shapes are normalized once. Components never see transport details.

**Violation:** the component reads the transport shape (string timestamps, the backend's nesting and field names).

```tsx
<p>{rental.car.displayName}, {rental.startsAt.slice(0, 10)} to {rental.endsAt.slice(0, 10)}</p>
```

**Fix:** a model in the feature's terms, and a mapper at the boundary.

```ts
// model/rental-summary.ts
export interface RentalPeriod { readonly start: Date; readonly end: Date }

export interface RentalSummary {
  readonly id: RentalId;
  carName: string;
  status: RentalStatus;
  period: RentalPeriod;
  cancellable: boolean;
}

export function rentalDays(period: RentalPeriod): number {
  return Math.ceil((period.end.getTime() - period.start.getTime()) / 86_400_000);
}
```

```ts
// api/rental-summary.ts
export function toRentalSummary(dto: RentalDto): RentalSummary {
  return {
    id: dto.id,
    carName: dto.car.displayName,
    status: dto.status,
    period: { start: new Date(dto.startsAt), end: new Date(dto.endsAt) },
    cancellable: dto.allowedActions.includes("cancel"),
  };
}

export function useRentalSummary(id: RentalId) {
  return useQuery({
    queryKey: rentalKeys.detail(id),
    queryFn: async () => toRentalSummary(await fetchRental(id)), // fetchRental calls the contract and parses the response
  });
}
```

## Keep business logic out of components

Components are the delivery mechanism, the frontend equivalent of route handlers. A condition that means something to the business gets a name in `model/`, and the component calls it.

**Violation:**

```tsx
{rental.status === "active" && rental.period.end.getTime() - now.getTime() < 86_400_000 && <DueBackSoonBanner />}
```

**Fix:**

```ts
// model/rental-summary.ts: plain TypeScript, unit-tested without rendering
export function isDueBackSoon(rental: RentalSummary, now: Date): boolean {
  return rental.status === "active" && rental.period.end.getTime() - now.getTime() < 86_400_000;
}
```

```tsx
{isDueBackSoon(rental, now) && <DueBackSoonBanner />}
```

This is frontend-owned display logic: when to show a reminder. A rule the backend decides, such as eligibility, stays there (see Validation is for usability).

## Server, UI, and derived state

- **Server state** belongs to the backend and lives in the query cache. Never copy it into `useState` or a store; read it where it is needed (the cache dedupes requests).
- **UI state** is local interaction: an open dialog, a draft form, the current step of a workflow. Keep it in the lowest component that needs it, or in a feature-scoped store for a multi-step workflow.
- **Derived state** is computed from the other two with pure functions in `model/`. Never store it.

**Violation:** derived state stored and kept in sync by hand.

```tsx
const [days, setDays] = useState(0);
useEffect(() => { setDays(rentalDays(rental.period)); }, [rental]);
```

**Fix:**

```tsx
const days = rentalDays(rental.period);
```

Model workflow steps as a discriminated union, so each step carries exactly what has been chosen so far:

```ts
type BookingStep =
  | { kind: "choosing_period" }
  | { kind: "choosing_car"; period: RentalPeriod }
  | { kind: "confirming"; period: RentalPeriod; carId: CarId };
```

Update workflow state through named pure functions in `model/`, not ad-hoc spreads repeated across components.

**Violation:**

```ts
setDraft({ ...draft, extras: [...draft.extras, extra] }); // the same spread, copied wherever extras change
```

**Fix:**

```ts
setDraft(addExtra(draft, extra)); // one place owns the shape, including what happens to a duplicate
```

## Explicit user actions

Name each action after the user's intent, in business language, and expose it from `application/`. Its outcome is a discriminated union the UI can render, including named rejections mapped from the API's error responses in `api/`.

**Violation:** a generic handler with status strings, and the request built inside the component.

```tsx
async function handleSubmit() {
  setStatus("loading");
  const response = await fetch("/rentals", { method: "POST", body: JSON.stringify(form) });
  setStatus(response.ok ? "done" : "error");
}
```

**Fix:**

```ts
// application/use-reserve-car.ts
type BookingRejection =
  | { kind: "car_unavailable" }
  | { kind: "customer_ineligible"; reason: IneligibilityReason };

type ReservationOutcome =
  | { kind: "idle" }
  | { kind: "reserving" }
  | { kind: "reserved"; rentalId: RentalId }
  | { kind: "rejected"; rejection: BookingRejection };

export function useReserveCar(): { reserveCar: (request: ReservationRequest) => void; outcome: ReservationOutcome } { ... }
```

```tsx
// ui/: the button names the intent, and every outcome has a rendering
const { reserveCar, outcome } = useReserveCar();
<button onClick={() => reserveCar(request)}>Reserve car</button>
```

When several reactions hang off one action (analytics, cache invalidation, a confirmation toast), name the moment explicitly, for example `BookingConfirmed`, and let each reaction subscribe instead of piling side effects into the action. Keep it lightweight: one reaction doesn't need an event.

## Validation is for usability

Client-side validation gives fast feedback. The backend is the only enforcement.

- Reuse the shared Zod request schema for field-level feedback (required fields, a period that ends after it starts), so client and API agree on shape.
- Never reproduce business rules the frontend can't see in full: availability, eligibility, cancellation windows, pricing. Show what the API publishes (allowed actions, quotes), and render the rejection when it refuses.
- Always handle the API rejecting a request the client considered valid.

**Violation:** a backend rule copied into the frontend, which drifts the day the rule changes.

```ts
const cancellable = rental.status === "BOOKED" && rental.startsAt > new Date().toISOString();
```

**Fix:** the backend publishes the decision, and the mapper carries it through (as in `toRentalSummary` above).

```ts
cancellable: dto.allowedActions.includes("cancel"),
```

Field feedback from the shared schema:

```ts
const result = ReserveCarRequestSchema.safeParse(draft);
const fieldErrors = result.success ? {} : z.flattenError(result.error).fieldErrors;
```

## Where this skill stops

**Decide here:** the capability and its language, the backend contexts and published DTOs it uses, the frontend model and its mappings, the split between server, UI, and derived state, the user actions and their outcomes, and the validation that is for usability.

**Let TDD drive:** the component breakdown, hook signatures, file names, and the internal structure of each folder.

**The stop signal:** if the work has moved from naming things and drawing boundaries to designing components or hook signatures, the modeling is finished. Write the test list, get it reviewed, and hand over to the `test-driven-development` skill.

## Anti-patterns

| Anti-pattern | What it means |
| --- | --- |
| Components read DTO fields | Map in `api/`; components see the model |
| Server data copied into `useState` or a store | Read it from the query cache where it is needed |
| A derived value stored and synced with `useEffect` | Compute it with a pure function from `model/` |
| The frontend re-implements a backend rule (availability, cancellation window, pricing) | Show what the API publishes and render its rejection |
| No rendering for the API rejecting a request | Client validation is for usability; handle the rejection |
| `handleSubmit`, `setStatus("error")`, `processItem` | Name the user intent; model the outcome as a union |
| Boolean flags for workflow steps | A discriminated union of steps |
| A feature mirrors a backend context instead of a user capability | Organise around the journey |
| Deep import into another feature | Go through its `index.ts` |
| React or the query library in `model/` | Keep the model pure |
| A business condition written inline in JSX | Name it as a pure function in `model/` |
| The same state-update spread repeated across components | A named pure update function in `model/` |
| A component in `src/ui/` imports a domain concept | Move it to the feature or shared domain that owns the concept |
| A domain-aware model or component buried in one feature but needed by others | Move it to a shared domain in `src/domains/<context>/` |
| Entity classes, rich aggregates, or an event bus for a thin projection | Plain types and pure functions |
