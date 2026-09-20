# Test-driven development in apps/webapp

Test what the user sees and does, not how components are built.

| Target | Tool | Approach |
|---|---|---|
| Components and flows | Vitest + React Testing Library + user-event | Render, interact, assert on visible output |
| API interaction | MSW | Mock at the network boundary; handlers use the contract's `path` and the fixture factories from `packages/shared` |
| Pure logic (`model/` calculations, DTO mappers, formatters) | Vitest | Plain unit tests |
| Custom hooks | `renderHook` | Only when the logic is non-trivial; otherwise test through a component |
| Critical user journeys | Playwright, in `apps/webapp/e2e/` | Two layers, stubbed and full-stack: read [playwright.md](playwright.md) |

- No snapshot tests.
- Cover loading, empty, and error states for every data-fetching component.

## Organize and place tests by capability

- A test file describes a user capability (`booking-a-rental.test.tsx`), not a component (`BookingForm.test.tsx`). It renders the capability's top component and exercises its children together, as the user would.
- A leaf component with meaningful logic of its own can have a focused test, driven by behavior; "every file needs a test" is not a reason.
- Keep tests in the feature folder, beside the code they cover. No parallel `tests/` tree.
- Playwright journeys live in `apps/webapp/e2e/`, which must be in a tsconfig `include` (the lint hook flags files outside one).

Test names read as requirements the user would recognize:

```tsx
describe("booking a rental", () => {
  it("shows a validation error when no car is selected");
  it("disables the confirm button until the booking is complete");
  it("reserves the car and shows the confirmation");
  it("tells the customer the car is no longer available when the booking is rejected");
});
```

## Test behavior, not implementation

A test that breaks when you rename a state variable, extract a child component, or change a CSS class is testing implementation; rewrite it.

**Bad:** internal state and DOM structure.

```tsx
expect(wrapper.state("isOpen")).toBe(true);
expect(container.querySelector(".modal")).toBeTruthy();
```

**Good:** what the user perceives.

```tsx
const user = userEvent.setup();
renderWithProviders(<RentalDetails rentalId={rentalId} />);
await user.click(screen.getByRole("button", { name: "Cancel rental" }));
expect(screen.getByRole("dialog", { name: "Cancel this rental?" })).toBeInTheDocument();
```

## Render through the real tree

Don't shallow-render, and never mock child components, hooks, or the query client. Render the real children, hooks, and providers; fake only the network, with MSW. If a test seems to need a mock inside the tree, the component has too many responsibilities.

**Bad:**

```tsx
vi.mock("@/features/book-rental/ui/price-summary");                  // hides the real integration
vi.mock("@/features/book-rental/application/use-booking-total");    // tests the mock, not the feature
```

**Good:** render the real `BookRental` with its real `PriceSummary` and hooks; MSW answers the requests those hooks make.

Render through a helper that wraps the app's real providers, plus any others the app root uses (theme, auth). A fresh query client per test stops cached data leaking between tests, and `retry: false` makes error states render at once instead of after the query library's retries:

```tsx
// apps/webapp/src/testing/render-with-providers.tsx
export function renderWithProviders(ui: ReactElement, { route = "/" } = {}): RenderResult {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    ),
  });
}
```

## React Testing Library practices

- Query in this order: `getByRole` with a `name`; `getByLabelText` for form fields; `getByText` or `getByDisplayValue`; `getByTestId` only when nothing accessible exists. Never `container.querySelector`.
- Query through `screen`, not the object `render` returns.
- Interact with `userEvent.setup()` and `await` every interaction; not `fireEvent`.
- `getBy*` when the element is there now; `queryBy*` only to assert absence; `findBy*` when it appears asynchronously.
- Wait with `findBy*`, or `waitFor` around an assertion, never a timeout. Keep side effects out of `waitFor`.
- Assert with jest-dom matchers (`toBeInTheDocument`, `toBeDisabled`, `toHaveValue`), registered once in the setup file with `import "@testing-library/jest-dom/vitest"`.

## Verify what was sent, not that something was called

Assert on the exact values that crossed a boundary: a callback prop's arguments, or the request body the API received. Never `expect.anything()`; it hides a component wiring the wrong field.

**Bad:**

```tsx
expect(onSubmit).toHaveBeenCalledWith(expect.anything());
```

**Good:**

```tsx
expect(onSubmit).toHaveBeenCalledWith({ email: "a@b.com", remember: true });
```

For the network, capture the request in the MSW handler and assert on it after the interaction:

```tsx
let reservation: unknown;
server.use(
  http.post("/api/rentals", async ({ request }) => {
    reservation = await request.json();
    return HttpResponse.json(aReservedRental(), { status: 201 });
  }),
);

await user.click(screen.getByRole("button", { name: "Reserve car" }));

expect(await screen.findByText("Your car is reserved")).toBeInTheDocument();
expect(reservation).toEqual({ carId, startsAt: "2026-10-01T09:00:00.000Z", endsAt: "2026-10-04T09:00:00.000Z" });
```
