---
name: implement
description: Designs and builds a change end to end. From a requirements brief it does the domain design (context map, domain documents, contract, test list) and stops once for your review; then it builds the test list through test-driven development, the suites the Definition of done requires, and the code-reviewer, and makes one commit. Start it yourself with /implement <docs/requirements/<feature>.md>, or with domain documents and test-list items to build something already designed.
disable-model-invocation: true
argument-hint: <docs/requirements/<feature>.md> | <docs/domain/<context>.md…> [test-list items]
---

# Implement

Input: $ARGUMENTS

Typing `/implement` is the user's request to design, build, and commit. It is not a request to push or open a pull request.

## 1. Find the input

- **A requirements brief** (`docs/requirements/<feature>.md`): design it in step 3, then build it.
- **One or more domain documents**, optionally followed by test-list items: the design is done. Skip step 3; the plan is those items (all of them if none are named), and step 4 is the scope check.
- **No input:** use the brief `/grill-me` wrote in this conversation. If there is none, ask which brief or documents to use.

Stop and point the user to `/grill-me` when there is no brief and the work needs a domain concept or frontend capability no document describes.

## 2. Check the working tree

Run `git status`. The brief and domain documents named in the input, the documents this skill writes, and `docs/domain/context-map.md` are part of the change and are committed with it. If the tree has other changes, ask the user to commit or stash them first; the review and the commit must contain only this change. If the current branch is `main`, create a branch named after the work and say so.

## 3. Design (from a brief)

The brief settles what is needed; this step decides how. Do not change what the brief agreed. If the design exposes a gap the brief does not answer, ask about it as a grilling round, until it is settled, and add the answer to the brief.

1. Follow the `domain-driven-design` skill, steps 1 to 11, with the brief as its input. Answer each of the brief's "Questions for design" in the design, and show the answers in step 4. Leave out its step-12 review; step 4 below replaces it.
2. If the brief has a user journey, also follow the `frontend-domain-modeling` skill, steps 1 to 9 (step 1 draws on the brief's user journey), leaving out its own review. For endpoints that do not exist yet, its step 3 uses the contract designed in step 9 of `domain-driven-design`.

Write no production code in this step. The contract is designed and recorded in the domain document; it is written to `packages/shared` in step 5, test first.

## 4. Review the design, then stop

This is the one place the user reviews before code is written. Show:
- the context map from `docs/domain/context-map.md`, as a Mermaid block;
- each domain document written or updated, by path, with a one-line summary of what changed;
- the published interfaces, both of which are contracts:
  - the HTTP contract: endpoint signatures with their errors and HTTP statuses;
  - each context interface (`index.ts`): the use cases other contexts call, and each domain event published, with its payload and the contexts that consume it;
- the rule placement table from each domain document: every rule and edge case from the brief, the context that owns it, and its owner: an invariant of a named aggregate, a value object's validation, a rule spanning several aggregates, or a reaction to a named event, with any frontend check marked as usability only;
- when the frontend was modelled, the frontend model: the capability, the DTO mappings, the split between server, UI, and derived state, and the user actions with their outcomes;
- the test list to build, in order, as test names under Domain, Application, and Frontend;
- the suites the Definition of done in `CLAUDE.md` requires for the parts of the code these items change. Read it there; do not work from memory.

Wait for the user's approval, and apply any changes they ask for. Their approval is the test-list approval the `test-driven-development` skill asks for.

When starting from domain documents, show only the test list and the suites, and wait for confirmation, unless the user approved that list earlier in this conversation.

## 5. Build

Follow the `test-driven-development` skill, one item at a time, red, green, refactor, in the approved order. A contract change updates `packages/shared` and both apps in the same change. Keep the domain documents and the context map in step with the code as you go.

The design is settled. If an item turns out to be ambiguous, or contradicts the documents or the code, delete any unfinished red test so the tree is green, then stop and ask instead of inventing a rule.

## 6. Verify

Run `typecheck` and `test` for every workspace you touched, and for both apps if `packages/shared` changed. Then run each suite named in step 4. Show the result of each.

- **A suite fails:** reproduce the failure in a failing test, fix it through the TDD cycle, and rerun. Never commit while a suite is red.
- **A suite cannot run** (Docker is down, an app will not start): stop and tell the user. The task is not done and nothing is committed.

Then check the rest of the Definition of done:
- every approved test-list item has a test, and it passes;
- `docs/domain/<context>.md`, `docs/domain/context-map.md`, and the contract match the code;
- nothing is left TODO, skipped, or `.only`.

## 7. Review

Run the `code-reviewer` agent. For each finding, fix it (through a failing test first when it changes behaviour) or decline it with a reason. After fixes, rerun the affected suites from step 6. If a fix changed behaviour, run the reviewer once more.

## 8. Commit

Stage the files this change touched by name, not with `git add -A`, and make one commit on the current branch. The message says which behaviours now exist, in the domain documents' terms, and lists the suites that ran. Do not push, open a pull request, or merge.

## 9. Report

Tell the user:
- the items built, and any you stopped on, with why;
- each suite you ran and its result, and any you did not run, with why (never describe a skipped suite as passing);
- the reviewer's findings, each marked fixed or declined with the reason;
- the branch and the commit hash.
