# Universal Harness — Agent Roles (OpenCode)

OpenCode ships two built-in primary agents and lets you define custom subagents as markdown files under `.opencode/agent/`. This harness uses that system to encode the different "hats" a solo builder normally has to hold at once — so the agent actually catches the things a generic coding assistant would miss.

## Primary agents (built in)

**Build** — full read/write/bash access. Your default agent for actually writing code, running the app, installing packages. Use this for all implementation phases in ROADMAP.md.

**Plan** — read-only, no edits, no bash. Switch to this (Tab key) when you want to discuss an approach, review a diff, or sanity-check an architecture decision before letting Build touch files. Use Plan before starting any new Phase in ROADMAP.md — have it read the relevant phase, propose a concrete file-by-file plan, and only switch to Build once you agree with the plan.

## Custom subagents

Defined as markdown files in `.opencode/agent/` and registered via `opencode.json`. Invoke with `@name` inside a session, or let Build call them automatically where relevant.

Create 1–3 domain-specific guardians for your product. The harness ships two proven templates; keep, rename, or replace them per app:

### Template 1: `@ux-guardian` (e.g. `@elder-ux-guardian` in Orchidum)

> Reviews any diff touching `src/modes/simple/` (or your core-mode path) against the hard rules in DESIGN_SYSTEM.md before it's considered done. This is your standing "designer + accessibility reviewer" — the one most likely to get skipped under dev pressure, so it's automated.

Use it: after any change inside the simple/core mode, before moving to the next task.
Example prompt: `@ux-guardian review the last change to SimpleHome.tsx`

When to customize: if your app has a zero-chrome, accessibility-critical, or single-gesture mode, keep this guardian and codify its 5–7 hard rules in DESIGN_SYSTEM.md. If not, rename it to `@design-guardian` and check spacing, contrast, and target sizes.

### Template 2: `@reliability-checker` (e.g. `@call-reliability-checker` in Orchidum)

> Reviews changes to the critical reliability path (`core/calling/`, `core/notifications/`, background handlers, token routes) against the failure modes called out in ROADMAP.md — background/killed-state behavior, token expiry, silent-failure-not-error-text on the user side. This is your standing "reliability + security" role for the single hardest technical part of the build.

Use it: before marking any phase that touches realtime/push/background as complete.
Example prompt: `@reliability-checker review the last change to PushService.ts`

When to customize: if your app has any background, realtime, or money-moving path that can fail silently (calls, payments, sync), keep this guardian. Otherwise replace with `@security-checker` or `@data-integrity-checker`.

### How to create a new subagent

1. Copy `.opencode/agent/_template.md` to `.opencode/agent/your-guardian.md`
2. Fill the frontmatter: `name`, `description`, `triggers` (paths that require it)
3. List 5–7 checkable rules (not vague advice) — each rule must be pass/fail on a diff
4. Add its trigger to HARNESS.md "Non-negotiable verification gates" so it cannot be skipped

```
---
name: your-guardian
description: What it protects and when to invoke it
triggers:
  - src/modes/simple/**
  - src/core/critical/**
---

You are the [role] for {{APP_NAME}}...

Checklist:
1. ...
```

### When to add a new subagent

- You find yourself saying "we keep regressing X" — encode X as a guardian
- A mode has hard rules that a generic reviewer would miss (e.g. elder-mode's 88dp, single tap, no text)
- A reliability path has subtle failure modes (killed-state push, token expiry, RLS bypass)

### When *not* to add a subagent

- For generic lint/typecheck — HARNESS.md already gates those
- For one-off reviews — use Plan mode instead

## Mapping back to the founder framework

A solo founder building alone is implicitly playing developer, designer, reliability engineer, and compliance at once, and the easiest one to drop under deadline pressure is whichever one isn't currently making the code fail to compile. Guardians exist so the judgment calls that are easy to skip when you're trying to ship a feature still get checked.

Compliance and payments-related roles are deliberately not encoded until the roadmap reaches that phase — don't add them prematurely.
