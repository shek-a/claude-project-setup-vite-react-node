# Requirements briefs

One brief per change, named after it (`stock-holds.md`). Each records **what** is needed and why, in the business's words: the problem, the actors, the agreed terms, the rules, concrete examples, edge cases, the user journey, and what is out of scope. A brief contains no design.

- **Writing one:** `/grill-me <the requirement>` interviews you until you share an understanding, then writes the brief from [`.claude/skills/grill-me/brief-template.md`](../../.claude/skills/grill-me/brief-template.md) for your approval.
- **Building from one:** `/implement docs/requirements/<feature>.md` designs the change from the brief (context map, [domain documents](../domain/README.md), contract, test list), stops for your review, then builds and commits it. The brief is committed with the code.

The domain documents are the living model; a brief is the record of one request. When they disagree, the domain document wins, and a new brief describes the change.
