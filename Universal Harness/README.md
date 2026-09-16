# Universal Harness — README

This folder is a **drop-in discipline kit** for any future app you build (mobile, web, backend). It is distilled from a real production app (Orchidum / Simplex) that survived 6 phases of verified device testing. Copy its files into the root of a new project, replace the `{{PLACEHOLDERS}}`, and you have the same guardrails that prevented regressions there.

## What you get

| File | Purpose |
|------|---------|
| `AGENTS.md` | Who you are, what not to build yet, coding conventions |
| `HARNESS.md` | How you work every turn — the operating loop |
| `ROLES.md` | Primary agents (build/plan) + how to define custom subagents |
| `DESIGN_SYSTEM.md` | Template for hard UX rules (e.g. elder-mode) |
| `TECH_STACK.md` | Tech choices table + folder structure + env vars |
| `ROADMAP.md` | Phased delivery plan template |
| `CHANGELOG.md` | Verified-behavior record |
| `opencode.json` | Loads the above files as instructions + registers skills/agents |
| `.opencode/agent/*.md` | Subagent definitions |
| `.opencode/skills/*.md` | Skills that enforce changelog + verification |

## How to start a new app in 30 seconds

1. Copy this whole folder into the new repo root.
2. Rename `{{APP_NAME}}`, `{{PACKAGE_ID}}`, `{{TEAM_NAME}}` in `AGENTS.md`, `TECH_STACK.md`, `ROADMAP.md`.
3. Fill `DESIGN_SYSTEM.md` — even if you keep only the shared foundations (colors, spacing unit, typography), commit it before writing any screen.
4. Fill `ROADMAP.md` Phase 0–X with *your* exit conditions — keep exit conditions testable (“two devices can complete a call”, not “calling feels good”).
5. Run `npm run typecheck` / `lint` gates from day one — green gates before any feature is “done”.

## The one rule

If a user request conflicts with `HARNESS.md`, **follow HARNESS.md and say so**. The harness exists to make output consistent even when the underlying model is weak. Skipping its loop is the single largest source of drift.

## Origin

Extracted from `E:\Applications\simplex` (Orchidum) — a React Native + Next.js + Supabase + LiveKit calling app. App-specific details (elder-mode tiles, LiveKit, offkin branding) are stripped; the discipline remains.
