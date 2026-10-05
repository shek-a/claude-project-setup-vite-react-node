---
name: coding-standards
description: Worked examples (violation and fix) for every rule in .claude/rules/typescript.md, .claude/rules/frontend/react.md, .claude/rules/frontend/tailwind.md, and .claude/rules/contract.md, covering SOLID, DRY, YAGNI, and KISS applied pragmatically, one level of abstraction, named predicates, discriminated unions for state, one source per set of values, satisfies, branded IDs, narrowing over `as`, Result for business failures, Zod at the boundary, @/ imports, no enums, configuration from the environment, React components, effects, and keys, Tailwind components, cva variants, cn(), and theme tokens, and the shared API contract both apps bind to. Use in the refactor step of the test-driven-development skill, when reviewing TypeScript, or when unsure how to apply one of those rules.
---

# Coding standards

Worked examples for the rules in `.claude/rules/typescript.md`, in the same order. The rules are the authority; these show what following them looks like. `tsconfig.base.json` and ESLint already enforce strict typing, no `any`, `interface` for object shapes, exhaustive switches, and explicit return types on backend and shared exports, so those need no examples.

React examples (components, hooks, effects, prop drilling, keys, naming) are in [react.md](react.md); Tailwind examples (extraction, `cva`, `cn()`, theme tokens, accessibility) are in [tailwind.md](tailwind.md); API contract examples (endpoint declaration, handler, client, fixtures) are in [contract.md](contract.md).

## Design

### Principles, applied pragmatically

Apply design patterns (Gang of Four), SOLID, DRY, YAGNI, and KISS **pragmatically**: introduce a pattern only when the problem in front of you calls for it. Never apply them mechanically or speculatively.

**Violation:** a strategy interface and a factory for the one pricing rule the business has.

```ts
interface PricingStrategy { price(rental: Rental): Money }
class PricingStrategyFactory { create(kind: PricingKind): PricingStrategy { ... } }
```

**Fix:** a function. Introduce the strategy when a second pricing rule arrives and the tests show the duplication.

```ts
function calculateRentalPrice(rental: Rental): Money { ... }
```

DRY is about knowledge, not text. Two functions that look alike but change for different business reasons are not duplication; merging them couples two rules that will diverge.

### Single responsibility

Every class, function, component, and hook has exactly one reason to change. If a unit does validation **and** pricing **and** formatting, split it: each piece owns one concept.

**Violation:**

```ts
function processRental(car: Car, customer: Customer): string {
  // checks eligibility, calculates the price, formats a receipt: three reasons to change
}
```

**Fix:** `checkRentalEligibility()`, `calculateRentalPrice()`, `formatReceipt()`, one concept each.

### One level of abstraction

A function either orchestrates or does low-level work. Never both.

**Violation:**

```ts
function checkout(cart: Cart, customer: Customer): void {
  for (const item of cart.items) { /* raw loop logic */ }
  sendEmail(customer.email, `Dear ${customer.name}...`); // low-level detail
  updateInventory(cart);
}
```

**Fix:** `checkout` only orchestrates; the details move into named steps.

```ts
function checkout(cart: Cart, customer: Customer): void {
  applyCartItems(cart);
  sendConfirmationEmail(customer);
  updateInventory(cart);
}
```

### When a complexity cap trips

ESLint caps cyclomatic complexity at 8. Every `case` counts, so an exhaustive switch that only maps a value fails once the union grows past about eight members.

**Violation:** complexity 10, and it grows with every new error case.

```ts
export function statusFor(error: ReserveCarError): number {
  switch (error.kind) {
    case "car_unavailable": return 409;
    case "customer_ineligible": return 403;
    case "period_invalid": return 400;
    case "payment_declined": return 402;
    case "licence_expired": return 403;
    case "car_off_fleet": return 409;
    case "overdue_returns": return 403;
    case "branch_closed": return 409;
    case "quote_expired": return 410;
  }
}
```

**Fix:** a lookup table. Complexity 1, the pairs read as data, and `satisfies` still requires an entry for every member of the union.

```ts
const ERROR_STATUS = {
  car_unavailable: 409, customer_ineligible: 403, period_invalid: 400,
  payment_declined: 402, licence_expired: 403, car_off_fleet: 409,
  overdue_returns: 403, branch_closed: 409, quote_expired: 410,
} as const satisfies Record<ReserveCarError["kind"], number>;

export function statusFor(error: ReserveCarError): number {
  return ERROR_STATUS[error.kind];
}
```

A switch is still right when each case does different *work* rather than returning a different value; if that switch trips the cap, the case bodies want extracting into named functions. The same applies to the other caps: nesting over 2 usually means an early return is missing, and more than 3 parameters usually means a missing value object or options object.

### Named predicates

**Violation:**

```ts
if (car.status === "available" && !customer.hasOverdueRentals && customer.licenseExpiry > now) {
```

**Fix:**

```ts
if (isEligibleForRental(car, customer, now)) {
```

### Ubiquitous language, not generic names

**Violation:**

```ts
class RentalManager {
  updateData(info: RentalInfo): void { ... }
}
```

**Fix:** name the business operation (see the `domain-driven-design` skill).

```ts
rental.returnCar(returnedAt);
```

### Clean code

- Name variables and functions so the code reads like prose; a reader should understand intent without comments.
- Minimize cognitive load: short functions, few parameters (ESLint caps them at 3), no surprise side effects.
- Prefer explicit over clever. If a future reader would pause to decode it, rewrite it.

## Types

### Discriminated unions for state

**Violation:** which flag combinations are valid? The type doesn't say.

```ts
interface Rental {
  isActive: boolean;
  isReturned: boolean;
  pickedUpAt?: Date;
  returnedAt?: Date;
}
```

**Fix:** each state carries exactly the data it has.

```ts
type RentalState =
  | { kind: "booked" }
  | { kind: "active"; pickedUpAt: Date }
  | { kind: "returned"; pickedUpAt: Date; returnedAt: Date };
```

### One source for each set of values

**Violation:** the same set declared twice, already drifted.

```ts
type CarStatus = "available" | "rented";                          // apps/backend
const CAR_STATUSES = ["available", "rented", "in_maintenance"];   // apps/webapp
```

**Fix:** declare the set once and derive the type from it. A Zod enum in `packages/shared` when it crosses the API; otherwise an `as const` array.

```ts
export const CarStatusSchema = z.enum(["available", "rented", "maintenance"]);
export type CarStatus = z.infer<typeof CarStatusSchema>;

const ROLES = ["admin", "customer", "agent"] as const;
type Role = (typeof ROLES)[number]; // "admin" | "customer" | "agent"
```

Once the type is a union, comparing against a literal is checked: `car.status === "availble"` is a compile error, so no separate constant is needed for a single value.

The set lives in the module of the concept it belongs to, as the `domain/` folder is grouped, and owns the subsets the domain names. A set that exists only as a type union has no runtime home, so the next lookup table or test spells it out again.

**Violation:** the event kinds exist only in the union, and a test relists the ones billing cares about, untyped.

```ts
export type RentalEvent = { kind: "car_booked"; … } | { kind: "car_returned"; … } | { kind: "car_returned_late"; … };   // domain/events.ts
const billable = ["car_returned", "car_returned_late"];                                                           // a test file
```

**Fix:** the set and its named subset beside the type, declared once; the subset is annotated with the set's type rather than declared `as const`, so a misspelled member fails to compile and `includes` accepts any member of the set. Tests import them.

```ts
// apps/backend/src/rentals/domain/events.ts
export const RENTAL_EVENT_KINDS = ["car_booked", "car_returned", "car_returned_late"] as const;
export type RentalEventKind = (typeof RENTAL_EVENT_KINDS)[number];
/** The events billing reacts to: a named subset, declared once beside its set. */
export const BILLABLE_EVENT_KINDS: readonly RentalEventKind[] = ["car_returned", "car_returned_late"];
```

A shared test value, such as a hold decision every test sends, comes from the test builders in `domain/testing/`, not from a `const` at the top of each test file.

### No enums

**Violation:** an `enum` emits runtime code, and Node's type stripping can't run it.

```ts
enum CarStatus { Available = "available", Rented = "rented" }
```

**Fix:** the Zod enum or `as const` array above gives the same autocomplete and a derived union type. ESLint rejects `enum`.

### Strings that carry meaning

A meaningful string is defined once, wherever it is used on either side.

**Violation:** the event name is retyped by every subscriber, and the cache key is invented at each call site. A rename fixes one of them and silently breaks the rest.

```ts
await queue.publish("rental.booked", payload);     // rentals
await queue.subscribe("rental.booked", handler);   // billing, retyped
await cache.get(`rental:${rentalId}`);             // and again wherever the cache is read
```

**Fix:** the context that owns the name owns the constant.

```ts
// apps/backend/src/rentals/domain/events.ts
export const RENTAL_EVENTS = {
  booked: "rental.booked",
  returned: "rental.returned",
} as const;

export const rentalCacheKey = (id: RentalId): string => `rental:${id}`;
```

```ts
await queue.publish(RENTAL_EVENTS.booked, payload);
await queue.subscribe(RENTAL_EVENTS.booked, handler);
await cache.get(rentalCacheKey(rentalId));
```

The frontend equivalents are route paths, query keys, and storage keys; see [react.md](react.md). Endpoint paths are never constants in an app at all: they come from the contract ([contract.md](contract.md)).

Two things are **not** magic strings. A value whose type is a literal union is already checked, so `status === "available"` needs no constant. And Tailwind class strings become a component, never a constant ([tailwind.md](tailwind.md)).

### `satisfies`

**Violation:** the annotation widens the keys, so a missing or misspelt car class goes unnoticed.

```ts
const DAILY_RATE: Record<string, number> = { economy: 40, premium: 90 };
```

**Fix:** every `CarClass` must have a rate, and the literal type is kept.

```ts
type CarClass = "economy" | "premium" | "van";
const DAILY_RATE = { economy: 40, premium: 90, van: 70 } satisfies Record<CarClass, number>;
```

### Branded IDs

**Violation:** plain strings can be swapped, and `as` creates a brand without checking anything.

```ts
function reserveCarForCustomer(customerId: string, carId: string): void { ... }
const carId = request.params["carId"] as CarId;
```

**Fix:** brands defined with Zod in `packages/shared`; the only way to get one is to parse.

```ts
export const CustomerIdSchema = z.uuid().brand<"CustomerId">();
export type CustomerId = z.infer<typeof CustomerIdSchema>;
export const CarIdSchema = z.uuid().brand<"CarId">();
export type CarId = z.infer<typeof CarIdSchema>;

const carId = CarIdSchema.parse(request.params["carId"]);
reserveCarForCustomer(customerId, carId);
reserveCarForCustomer(carId, customerId); // compile error: arguments swapped
```

### Narrowing over `as`

**Violation:** nothing guarantees the list is non-empty; `noUncheckedIndexedAccess` was warning about exactly this.

```ts
const next = upcomingBookings[0] as Booking;
```

**Fix:** narrow, and handle the case the type is pointing at.

```ts
const next = upcomingBookings[0];
if (next === undefined) return noUpcomingBooking();
```

Use a type predicate to narrow your own unions:

```ts
type ActiveRental = Extract<RentalState, { kind: "active" }>;
const active = states.filter((state): state is ActiveRental => state.kind === "active");
```

When `as` is genuinely unavoidable, the comment says why it is safe:

```ts
// Object.keys returns string[]; DAILY_RATE satisfies Record<CarClass, number>, so every key is a CarClass.
const carClasses = Object.keys(DAILY_RATE) as CarClass[];
```

## Imports

### The `@/` alias

**Violation:** relative paths break when files move and hide where the code lives.

```ts
import { toRentalSummary } from "../../api/rental-summary";
```

**Fix:** import an app's own modules through `@/` (ESLint enforces this under `apps/*/src`).

```ts
import { toRentalSummary } from "@/features/book-rental/api/rental-summary";
```

Inside `packages/*`, use relative imports: `@/` would resolve against whichever app consumes the package. Import other workspaces by package name.

Setup, once per app:

```jsonc
// apps/<app>/tsconfig.json
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```

```ts
// apps/<app>/vitest.config.ts, and vite.config.ts in apps/webapp
resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
```

`apps/backend` must run through something that resolves tsconfig paths, such as `tsx` or a bundler like `tsup`; `tsc` output run with plain `node` does not.

## Errors and input

### `Result` for business failures

The examples assume this shape, defined once in `packages/shared` (or a library such as neverthrow):

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

**Violation:** an expected outcome thrown as an exception, invisible in the signature.

```ts
function rentCar(car: Car, customer: Customer, period: RentalPeriod): Rental {
  if (!car.isAvailableFor(period)) throw new Error("Car not available");
  ...
}
```

**Fix:** the failure is a named case in the return type, and the HTTP layer maps each case to a response. A missing case is a lint error.

```ts
type RentCarError =
  | { kind: "car_unavailable"; carId: CarId }
  | { kind: "customer_ineligible"; reason: IneligibilityReason };

function rentCar(car: Car, customer: Customer, period: RentalPeriod): Result<Rental, RentCarError> { ... }

function toHttpError(error: RentCarError): HttpError {
  switch (error.kind) {
    case "car_unavailable":
      return { status: 409, message: `Car ${error.carId} is not available` };
    case "customer_ineligible":
      return { status: 403, message: error.reason };
  }
}
```

### Exceptions are for infrastructure failures and bugs

Give them a class, and keep the original error as `cause`. `Error.captureStackTrace` is unnecessary (and V8-only, so not allowed in `packages/shared`).

```ts
class PaymentGatewayUnavailable extends Error {
  override readonly name = "PaymentGatewayUnavailable";
}

try {
  await gateway.charge(payment);
} catch (error: unknown) {
  throw new PaymentGatewayUnavailable("Payment gateway did not respond", { cause: error });
}
```

### Zod at the boundary

**Violation:** untrusted input checked by hand and cast; nothing verifies that `name` is a string.

```ts
function createCustomer(body: unknown): Customer {
  if (typeof body === "object" && body !== null && "name" in body) {
    const { name } = body as { name: string };
    ...
  }
}
```

**Fix:** parse with the shared schema at the edge; inside the boundary, trust the type.

```ts
const parsed = CreateCustomerSchema.safeParse(request.body);
if (!parsed.success) return badRequest(parsed.error);
return createCustomer(parsed.data);
```

### Configuration from the environment

**Violation:** a hardcoded fallback works on one machine and is silently wrong everywhere else.

```ts
const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8082";
```

**Fix:** parse the environment once at startup. A missing or malformed variable fails at boot with its name, not at the first request.

```ts
// apps/webapp/src/config.ts (apps/backend/src/config.ts parses process.env the same way)
const EnvSchema = z.object({ VITE_API_URL: z.url() });
export const config = EnvSchema.parse(import.meta.env);
```

Everything else imports `config`; `src/config.ts` is the only file allowed to touch `process.env` or `import.meta.env`, and ESLint enforces that.

**Violation:** an unvalidated read in a component, far from startup.

```tsx
const timeout = Number(import.meta.env.VITE_TIMEOUT_MS ?? 5000);
```

**Fix:**

```tsx
import { config } from "@/config";

const timeout = config.VITE_TIMEOUT_MS;
```

Commit `.env.example` with a working local value for every variable in the schema, and never commit `.env`. Values that aren't environment-specific (route paths, domain values) stay in code.

In `apps/webapp`, remember the whole environment is compiled into the bundle the browser downloads, and Vite only exposes `VITE_`-prefixed variables at all: no secret belongs there. Secrets stay in `apps/backend`, whose config comes from the platform's environment.
