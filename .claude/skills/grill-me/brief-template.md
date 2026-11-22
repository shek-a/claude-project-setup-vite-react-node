# <Feature name>

What is needed and why, in the business's words. No design: bounded contexts, aggregates, endpoints, tables and tests are decided later by `/implement`.

## Problem
One paragraph: what is wrong or missing today, and who it hurts.

## Actors
Who triggers each action, and who is affected.

## Language
The terms agreed in the interview. Reuse a term an existing `docs/domain/` document already uses.

| Term | Meaning | Avoid |
|---|---|---|

## Rules
What must always be true, and what must never happen.

## Examples
Concrete cases with real numbers, each one a rule in action. They become the expected values in tests.
- Given …, when …, then ….

## Edge and failure cases
What can go wrong, and what should happen when it does.

## User journey
Only when people use it through the app: who does what, what they see, and what they see when it goes wrong.

## Out of scope

## Questions for design
Design questions raised in the interview and left for `/implement` to decide, unanswered here (for example, "should holds be their own records or a status on the order line?").
