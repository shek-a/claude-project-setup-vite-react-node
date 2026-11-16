---
name: implement
description: Builds an agreed plan end to end, from the test list in a domain document (or a named subset of it) through test-driven development, the suites the Definition of done requires, the code-reviewer, and one commit. Start it yourself with /implement <docs/domain/<context>.md> [test-list items].
disable-model-invocation: true
argument-hint: <docs/domain/<context>.md> [test-list items]
---

# Implement

Input: $ARGUMENTS

Typing `/implement` is the user's request to build the plan and commit it. It is not a request to push or open a pull request.

## 1. Find the plan

The plan is a reviewed test list:
- **Backend and contract items** come from the test list in the domain document named in the input, limited to the items named after it (all of them if none are named).
- **Frontend items** come from the test list the user reviewed at the end of `/frontend-domain-modeling` in this conversation.
- **With no input,** use the plan the user already agreed in this conversation. A plan agreed only in conversation (for example after `/grill-me`) is enough only when it adds no new domain concept and no new frontend capability. If it has no test list yet, draft one from what was agreed, in the domain document's terms, adding nothing that was not agreed; step 2 is where the user approves it.

Stop and say what is missing instead of starting when:
- The work adds a domain concept that `docs/domain/<context>.md` does not yet describe. Point the user to `/domain-driven-design` (or `/grill-me` to settle the idea first).
- The work adds a frontend capability with no reviewed `/frontend-domain-modeling` test list. Point the user to that skill.

The plan's decisions are settled. Do not redesign while building. If an item turns out to be ambiguous, or contradicts the document or the code, delete any unfinished red test so the tree is green, then stop and ask instead of inventing a rule.

## 2. Confirm the scope

Check the working tree with `git status`. If it has changes that are not part of this plan, ask the user to commit or stash them first; the review and the commit must contain only this plan. If the current branch is `main`, create a branch named after the work and say so.

Show the user, then wait for confirmation:
- The test-list items you will build, in order, as test names. Mark any you drafted in step 1 so the user can see which ones they have not reviewed before.
- The suites the Definition of done in `CLAUDE.md` requires for the parts of the code these items change. Read it there; do not work from memory.

This confirmation is the test-list approval the `test-driven-development` skill asks for.

## 3. Build

Follow the `test-driven-development` skill, one item at a time, red, green, refactor, in the confirmed order. A contract change updates `packages/shared` and both apps in the same change. Keep the domain document and the contract in step with the code as you go.

## 4. Verify

Run `typecheck` and `test` for every workspace you touched, and for both apps if `packages/shared` changed. Then run each suite named in step 2. Show the result of each.

- **A suite fails:** reproduce the failure in a failing test, fix it through the TDD cycle, and rerun. Never commit while a suite is red.
- **A suite cannot run** (Docker is down, an app will not start): stop and tell the user. The task is not done and nothing is committed.

Then check the rest of the Definition of done:
- every confirmed test-list item has a test, and it passes;
- `docs/domain/<context>.md` and the contract match the code;
- nothing is left TODO, skipped, or `.only`.

## 5. Review

Run the `code-reviewer` agent. For each finding, fix it (through a failing test first when it changes behaviour) or decline it with a reason. After fixes, rerun the affected suites from step 4. If a fix changed behaviour, run the reviewer once more.

## 6. Commit

Stage the files this plan changed by name, not with `git add -A`, and make one commit on the current branch. The message says which behaviours now exist, in the domain document's terms, and lists the suites that ran. Do not push, open a pull request, or merge.

## 7. Report

Tell the user:
- the items built, and any you stopped on, with why;
- each suite you ran and its result, and any you did not run, with why (never describe a skipped suite as passing);
- the reviewer's findings, each marked fixed or declined with the reason;
- the branch and the commit hash.
