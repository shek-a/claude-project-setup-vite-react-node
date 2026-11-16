---
name: grill-me
description: Gathers the requirements for a change by grilling you until you share an understanding, then writes them as a requirements brief in docs/requirements/ for /implement to design and build from. Requirements only, no design. Start it yourself with /grill-me <the requirement>.
disable-model-invocation: true
argument-hint: <the requirement>
---

<!-- Adapted from grill-me in https://github.com/mattpocock/skills (MIT; see LICENSE beside this file). -->

# Grill me

Requirement: $ARGUMENTS

This skill settles **what** is needed. It does not decide **how**: no bounded contexts, aggregates, endpoints, tables, libraries, or tests. `/implement` makes those decisions from the brief. Write nothing except the brief.

## 1. Read what exists

Read `docs/domain/*.md` for the current contexts and their language, and `docs/requirements/` for earlier briefs. Look at the code when it already answers a question. You will need these to recommend terms the project already uses.

## 2. Grill

Follow the `grilling` skill on the requirement. The design tree is the business only:
- the problem, and who triggers each action;
- the rules: what must always be true and what must never happen;
- concrete examples with real numbers;
- edge cases, what can go wrong, and what should happen then;
- when people use it through the app, the user journey: what they do, what they see, and what they see when it goes wrong;
- what is out of scope.

Terminology: where two terms look synonymous, ask which one the business says. List the candidates with where each appears (the user's words, `docs/domain/`, the code), and recommend only a term the user or an existing document already uses, never one you coined.

Look up anything the code or the documents already answer instead of asking. If the user raises a design question (which service, which table, which endpoint), note it under "Questions for design" in the brief and keep the interview on the business.

Grilling ends when the frontier is empty and the user confirms you share an understanding.

## 3. Write the brief

Write `docs/requirements/<feature-slug>.md` from [brief-template.md](brief-template.md), using only what was agreed. Leave out a section with nothing in it (for example the user journey of a backend-only change). Show the user the brief and apply any corrections.

When they approve it, end with the next command: `/implement docs/requirements/<feature-slug>.md`.
