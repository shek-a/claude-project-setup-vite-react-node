# React coding standards

Worked examples for `.claude/rules/frontend/react.md`. Layering and domain modeling (what goes in `model/`, `application/`, `api/`, `ui/`) are in the `frontend-domain-modeling` skill.

## No prop drilling

**Violation:** `user` threaded through layers that ignore it.

```tsx
<Page user={user}>
  <Sidebar user={user}>        {/* Sidebar doesn't use user... */}
    <Nav user={user}>          {/* ...nor Nav; it's only passing it through */}
      <Avatar user={user} />   {/* only Avatar needs it */}
```

**Fix (composition):** the parent that owns `user` composes the leaf, so the middle layers stay unaware of it.

```tsx
<Page>
  <Sidebar>
    <Nav>
      <Avatar user={user} />
```

**Fix (context), for cross-cutting state only** such as the current user, theme, or locale:

```tsx
const user = useCurrentUser(); // from UserProvider; no intermediate props
return <Avatar user={user} />;
```

## Single responsibility

**Violation:** one component fetches, transforms, and renders.

```tsx
function UserProfile({ userId }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then((response) => response.json())
      .then((raw) => { setUser({ ...raw, fullName: `${raw.first} ${raw.last}` }); });
  }, [userId]);
  return <div>{user?.fullName}</div>;
}
```

**Fix:** a query hook in `api/` fetches, parses, and maps to the model; the component only renders.

```tsx
function UserProfile({ userId }: UserProfileProps) {
  const { data: user } = useUser(userId);
  return <div>{user?.fullName}</div>;
}
```

## One level of abstraction

**Violation:** arithmetic, a pricing rule, formatting, and a raw request, mixed into the render.

```tsx
function Checkout({ cart }: CheckoutProps) {
  const total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 1.2;
  return (
    <form onSubmit={(event) => { event.preventDefault(); void fetch("/api/payments", { method: "POST" }); }}>
      <span>{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(total)}</span>
    </form>
  );
}
```

**Fix:** the backend prices the cart, the payment is a named user action, and formatting is a named function; the component only orchestrates.

```tsx
function Checkout({ cartId }: CheckoutProps) {
  const { data: quote } = useCheckoutQuote(cartId);
  const { payForCart } = usePayForCart();
  const handlePayForCart = (event: FormEvent) => { event.preventDefault(); payForCart(cartId); };
  return (
    <form onSubmit={handlePayForCart}>
      <span>{quote && formatMoney(quote.total)}</span>
    </form>
  );
}
```

## Naming and function style

**Violation:** a `React.FC` arrow component and a generic handler name.

```tsx
const RentalCard: React.FC<{ rental: RentalSummary }> = ({ rental }) => {
  const handleClick = () => { cancel(rental.id); };
  return <button onClick={handleClick}>Cancel rental</button>;
};
```

**Fix:** a function declaration with a props `interface`; the handler inside is a `const` arrow named for the intent, and the handler prop is `onX`. ESLint rejects arrow components and `React.FC`.

```tsx
interface RentalCardProps {
  rental: RentalSummary;
  onCancelRental: (id: RentalId) => void;
}

function RentalCard({ rental, onCancelRental }: RentalCardProps) {
  const handleCancelRental = () => { onCancelRental(rental.id); };
  return <button onClick={handleCancelRental}>Cancel rental</button>;
}
```

## Component size and scope

**Violation:** a 400-line `Dashboard` that fetches data, holds filter state, computes totals, and renders the header, filters, chart, and table.

**Fix:** `Dashboard` composes children that each own one slice:

```tsx
function Dashboard() {
  return (
    <>
      <DashboardHeader />
      <RentalFilters />
      <UtilisationChart />
      <RentalsTable />
    </>
  );
}
```

Extract a child when a block of JSX is reused, has its own state, or is a self-contained unit. A component taking more than about 5 to 7 props is doing too much: group related props into an object, or split it.

## Keys and immutability

**Violation:** the index as a key, so reordering or removing an item reuses the wrong component state.

```tsx
{rentals.map((rental, index) => <RentalCard key={index} rental={rental} onCancelRental={cancelRental} />)}
```

**Fix:** a stable, unique key from the data.

```tsx
{rentals.map((rental) => <RentalCard key={rental.id} rental={rental} onCancelRental={cancelRental} />)}
```

Never mutate props or state: produce new arrays and objects (`[...extras, extra]`, `{ ...draft, period }`), ideally through a named update function in `model/`.

## Constants for routes, query keys, and storage keys

**Violation:** the same strings typed in several places.

```tsx
navigate("/rentals/history");
useQuery({ queryKey: ["rentals", id], ... });
localStorage.getItem("auth_token");
```

**Fix:** define each once. A query-key factory also makes invalidation precise.

```ts
export const ROUTES = {
  rentalHistory: "/rentals/history",
  rental: (id: RentalId) => `/rentals/${id}`,
} as const;

export const rentalKeys = {
  all: ["rentals"] as const,
  detail: (id: RentalId) => ["rentals", id] as const,
};

export const STORAGE_KEYS = { authToken: "auth_token" } as const;
```

```tsx
navigate(ROUTES.rentalHistory);
useQuery({ queryKey: rentalKeys.detail(id), ... });
queryClient.invalidateQueries({ queryKey: rentalKeys.all });
```

## Effects

`useEffect` synchronises with systems outside React. It is an escape hatch, not a default; each misuse below costs an extra render and invites stale-closure bugs.

**Derived data:** compute it during render.

```tsx
// Violation
const [fullName, setFullName] = useState("");
useEffect(() => { setFullName(`${first} ${last}`); }, [first, last]);

// Fix
const fullName = `${first} ${last}`;
```

**Responding to an event:** do it in the handler.

```tsx
// Violation
useEffect(() => { if (isBreakdownOpen) track("price_breakdown_opened"); }, [isBreakdownOpen]);

// Fix
const handleOpenPriceBreakdown = () => { setIsBreakdownOpen(true); track("price_breakdown_opened"); };
```

**Resetting state when a prop changes:** remount with `key`.

```tsx
// Violation
useEffect(() => { setDraft(emptyDraft); }, [carId]);

// Fix
<BookingForm key={carId} carId={carId} />
```

**Fetching:** use the feature's query hook, never `fetch` in an effect (see Single responsibility).

**A real effect** has something to undo, which is the cleanup test:

```tsx
useEffect(() => {
  const subscription = rentalUpdates.subscribe(rentalId, handleRentalUpdate);
  return () => { subscription.unsubscribe(); };
}, [rentalId, handleRentalUpdate]);
```

Give every effect its complete dependency list; ESLint checks it. If the list causes re-runs, stabilise the value or callback rather than dropping it.

## Custom hooks

**Violation:** `useState` and `useEffect` for debouncing, subscriptions, or data scattered through the component body.

**Fix:** a hook whose name states the intent, so the component reads like prose.

```tsx
const { data: rentals, isPending, error } = useRentals(filters);
const debouncedSearch = useDebouncedValue(search, 300);
```
