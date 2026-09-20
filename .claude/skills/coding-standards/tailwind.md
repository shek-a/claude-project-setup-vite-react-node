# Tailwind examples

Worked examples for `.claude/rules/frontend/tailwind.md`. The lint hook runs `eslint --fix`, which sorts classes into canonical order on every edit, so class order is never worth hand-editing.

## Extract components, don't duplicate class strings

A repeated class string is a DRY and single-level-of-abstraction smell. The fix is a named component, not a copied string.

**Violation:** the same long button string pasted wherever a button is needed.

```tsx
<button className="inline-flex items-center rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand/90 focus-visible:ring-2">Save</button>
<button className="inline-flex items-center rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand/90 focus-visible:ring-2">Confirm</button>
```

**Fix:** one `Button` owns the classes; call sites read at one level of abstraction.

```tsx
<Button intent="primary">Save</Button>
<Button intent="danger">Cancel rental</Button>
```

## When to extract vs keep inline

Extract a component when one or more of these is true:

1. The same group of classes appears in more than one place.
2. The styling represents a reusable UI concept (button, input, card, badge).
3. Conditional classes make the JSX hard to follow.
4. The element has several sizes, states, or variants (use `cva`).
5. The class list distracts from the component's behavior.

Keep classes inline when they are specific to one place and reasonably short. Page layout is fine inline:

```tsx
<main className="mx-auto grid max-w-5xl gap-6 p-6 md:grid-cols-2">
```

**Violation:** naming a class string without making it a component, in JavaScript or CSS.

```tsx
const cardClasses = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm";
```

```css
.card { @apply rounded-lg border border-slate-200 bg-white p-4 shadow-sm; }
```

**Fix:** if a class list is worth naming, it is worth a component.

```tsx
function Card({ children }: CardProps) {
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}
```

## Typed variants with `cva`

Variants modelled with `cva` get typed, autocompleted props, and the class lists live in one place: the styling form of one source for each set of values.

```tsx
// src/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/ui/cn";

const button = cva("inline-flex items-center rounded-lg px-4 py-2 font-medium focus-visible:ring-2", {
  variants: {
    intent: {
      primary: "bg-brand text-white hover:bg-brand/90",
      danger: "bg-red-600 text-white hover:bg-red-700",
    },
    size: { sm: "px-3 py-1.5 text-sm", md: "text-base" },
  },
  defaultVariants: { intent: "primary", size: "md" },
});

type ButtonProps = VariantProps<typeof button> & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ intent, size, className, ...props }: ButtonProps) {
  return <button className={cn(button({ intent, size }), className)} {...props} />;
}
```

## Conditional classes with `cn()`

`clsx` handles conditions and `tailwind-merge` resolves conflicts (the last one wins). Wrap them once:

```ts
// src/ui/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
```

**Violation:** both `px-2` and `px-4` are emitted, and which one wins depends on the generated CSS, not on your intent. Lint doesn't catch this form, so it is on you.

```tsx
<div className={`px-2 ${isWide ? "px-4" : ""}`} />
```

**Fix:**

```tsx
<div className={cn("px-2", isWide && "px-4")} />
```

## Theme tokens, not arbitrary values

**Violation:** one-off magic numbers, the styling form of a magic literal. ESLint rejects arbitrary values, and suggests the matching token when the theme has one.

```tsx
<p className="mt-[13px] text-[15px] text-[#3b7dd8]">
```

**Fix:** use the scale, and add a value that belongs to the design to `@theme` in the CSS entry file, then use it by name.

```css
/* apps/webapp/src/index.css */
@import "tailwindcss";

@theme {
  --color-brand: #3b7dd8;
}
```

```tsx
<p className="mt-3 text-sm text-brand">
```

## Keep variants inline until they don't fit

**Violation:** one element piling up state, dark-mode, and responsive variants for a concept used across the navigation.

```tsx
<a className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white md:px-4 md:text-base dark:text-slate-300 dark:hover:bg-slate-800">
```

**Fix:** a `NavItem` component whose active state is a `cva` variant.

```tsx
const navItem = cva("rounded-md px-3 py-2 text-sm focus-visible:ring-2 md:px-4 md:text-base", {
  variants: {
    active: {
      true: "bg-slate-900 text-white",
      false: "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
    },
  },
});
```

## Accessibility

**Violation:** the focus indicator removed with nothing in its place.

```tsx
<button className="outline-none">Reserve car</button>
```

**Fix:**

```tsx
<button className="outline-none focus-visible:ring-2 focus-visible:ring-brand">Reserve car</button>
```

**Violation:** a status carried by color alone.

```tsx
<span className="size-2 rounded-full bg-red-600" />
```

**Fix:** the text carries the meaning; the color reinforces it.

```tsx
<span className="font-medium text-red-700">Overdue</span>
```

**Violation:** a styled `div` pretending to be a button, invisible to keyboards, screen readers, and `getByRole`.

```tsx
<div className="cursor-pointer rounded-lg bg-brand px-4 py-2" onClick={reserveCar}>Reserve car</div>
```

**Fix:**

```tsx
<Button onClick={reserveCar}>Reserve car</Button>
```
