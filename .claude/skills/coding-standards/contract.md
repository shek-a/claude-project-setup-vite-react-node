# API contract examples

Worked examples for `.claude/rules/contract.md`. `@acme/shared` below is whatever `packages/shared` is named in the project's `package.json`.

## Declare the endpoint once

```ts
// packages/shared/src/rentals/contract.ts
import { z } from "zod";
import type { Endpoint } from "@/http/endpoint";

export const ReserveCarRequestSchema = z.object({
  carId: CarIdSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});

export const RentalDtoSchema = z.object({
  id: RentalIdSchema,
  car: z.object({ displayName: z.string() }),
  status: z.enum(["booked", "active", "returned"]),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  allowedActions: z.array(z.enum(["cancel", "extend"])),
});

export const ReserveCarErrorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("car_unavailable"), carId: CarIdSchema }),
  z.object({ kind: z.literal("customer_ineligible"), reason: z.enum(["overdue_returns", "licence_expired"]) }),
]);

export const ERROR_STATUS = {
  car_unavailable: 409,
  customer_ineligible: 403,
} as const satisfies Record<ReserveCarError["kind"], number>;

export const reserveCar = {
  method: "POST",
  path: "/api/rentals",
  request: ReserveCarRequestSchema,
  response: RentalDtoSchema,
  errors: ReserveCarErrorSchema,
} as const satisfies Endpoint;

export type ReserveCarRequest = z.infer<typeof ReserveCarRequestSchema>;
export type RentalDto = z.infer<typeof RentalDtoSchema>;
export type ReserveCarError = z.infer<typeof ReserveCarErrorSchema>;
```

`as const satisfies Endpoint` matters: `satisfies` checks the shape while keeping the literal types, so `reserveCar.errors` stays a schema you can call `.parse` on. A plain `: Endpoint` annotation would widen it.

The shared helpers this relies on:

```ts
// packages/shared/src/http/endpoint.ts
import type { ZodType } from "zod";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface Endpoint {
  method: HttpMethod;
  path: `/${string}`;
  params?: ZodType;
  request?: ZodType;
  response: ZodType;
  errors?: ZodType;
}

export function buildPath(endpoint: Endpoint, params: Record<string, string> = {}): string {
  return endpoint.path.replace(/:(\w+)/g, (_match: string, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing path parameter "${name}" for ${endpoint.path}`);
    return encodeURIComponent(value);
  });
}
```

## The API binds to the contract

**Violation:** the path, the status codes, and the response shape are decided in the handler, where the frontend can't see them.

```ts
router.post("/api/rentals", async (request, response) => {
  const result = await rentCar(request.body);
  if (!result.ok) { response.status(400).json({ message: "Could not reserve car" }); return; }
  response.status(201).json({ rentalId: result.value.id });
});
```

**Fix:** the route, the input parsing, the success type, and the statuses all come from the contract. If the schema changes, this file stops compiling.

```ts
// apps/backend/src/rentals/http/reserve-car-route.ts
import { ERROR_STATUS, reserveCar, type RentalDto } from "@acme/shared";

router.post(reserveCar.path, async (request, response) => {
  const command = reserveCar.request.parse(request.body);
  const result = await rentCarUseCase(command);

  if (!result.ok) {
    response.status(ERROR_STATUS[result.error.kind]).json(result.error);
    return;
  }

  const body: RentalDto = toRentalDto(result.value);
  response.status(201).json(body);
});
```

## The web client binds to the same contract

**Violation:** a second declaration of the same endpoint, which nothing keeps in step.

```ts
interface RentalResponse { id: string; carName: string }   // a hand-written copy of the API's shape

const response = await fetch("/api/rentals", { method: "POST", body: JSON.stringify(command) });
if (response.status === 400) return err({ kind: "unavailable" });   // a guess at the API's errors
```

**Fix:** one import, and both bodies parsed by the contract's schemas.

```ts
// apps/webapp/src/features/book-rental/api/reserve-car.ts
import { buildPath, reserveCar, type ReserveCarError, type ReserveCarRequest, type RentalDto } from "@acme/shared";

export async function postReservation(
  command: ReserveCarRequest,
): Promise<Result<RentalDto, ReserveCarError>> {
  const response = await fetch(buildPath(reserveCar), {
    method: reserveCar.method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command),
  });

  const body: unknown = await response.json();
  return response.ok
    ? ok(reserveCar.response.parse(body))
    : err(reserveCar.errors.parse(body));
}
```

The feature's `application/` layer maps `ReserveCarError` into its own rejection union, and `RentalDto` into its model, so the rest of the frontend never sees transport types.

## One set of fixtures

**Violation:** the same response invented twice, so both suites can pass while the two disagree.

```ts
// apps/backend test
const rental = { id: "r-1", carName: "VW Golf", status: "BOOKED" };
// apps/webapp MSW handler
return HttpResponse.json({ id: "r-1", car: { displayName: "VW Golf" }, status: "booked" });
```

**Fix:** a factory beside the contract, parsed through the schema so an invalid fixture fails where it is written.

```ts
// packages/shared/src/rentals/fixtures.ts
export function aReservedRental(overrides: Partial<RentalDto> = {}): RentalDto {
  return RentalDtoSchema.parse({
    id: "b3f1c0de-0000-4000-8000-000000000001",
    car: { displayName: "VW Golf" },
    status: "booked",
    startsAt: "2026-10-01T09:00:00.000Z",
    endsAt: "2026-10-04T09:00:00.000Z",
    allowedActions: ["cancel"],
    ...overrides,
  });
}
```

```ts
// apps/webapp/src/testing/handlers.ts: used by the component tests and the Playwright UI project
export const handlers = [
  http.post(reserveCar.path, () => HttpResponse.json(aReservedRental(), { status: 201 })),
];
```

## Changing a contract

Change both sides in the same change. Adding a required response field and shipping only the API leaves the frontend parsing a shape it doesn't know; adding it to the frontend first leaves it parsing a field the API never sends.

The Stop hook typechecks and tests `packages/*`, `web`, and `api` whenever `packages/` changes, so an unfinished contract change fails the turn.

What the compiler catches, and when:

| Change | Fails where |
|---|---|
| A field is renamed or removed | Both sides: whatever builds the response, and whatever reads the field |
| A required field is added | The side that builds the response; readers are unaffected, which is correct |
| A fixture no longer matches its schema | At runtime, the moment a test calls the factory, because `parse` accepts `unknown` |
