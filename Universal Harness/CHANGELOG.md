# {{APP_NAME}} — Change Log & Verified Behavior Record

This file is the source of truth for "what works and what has broken." It exists because fixes to one feature kept regressing features that were already verified on real devices.

## Rules (read before changing anything)

1. Before touching any code path listed below, re-read the relevant "VERIFIED" entry and keep its expected behavior intact.
2. Every entry below was confirmed with real device logs, not assumptions. If a verification is outdated, mark it STALE with the date instead of deleting it silently.
3. When a fix changes a VERIFIED path, re-run the verification and update this file in the same change. No verification = no edit to this file.

---

## Environment (current as of {{DATE}})

| Item | Value |
|---|---|
| Devices | {{e.g. Elder Realme RMX3710 serial ... / Admin Xiaomi ...}} |
| Backend | {{e.g. https://{{app}}.vercel.app}} |
| Database | {{e.g. Supabase project ref}} |
| Build | {{e.g. release 50 MB (R8) / debug 96 MB}} |

---

## Template — how to write a VERIFIED entry

```md
## VERIFIED — {{feature}} (Phase {{N}}, added {{DATE}})

- **Request:** one-line user request
- **Implementation:** what changed (files, logic, tokens)
- **Verified {{DATE}} (real devices):** what was run, what was observed (logs, dumpsys, screencap, HTTP status)
- **Gates:** typecheck 0 errors; lint 0 errors (N warnings)
- **Subagent reviews:** @ux-guardian APPROVE / @reliability-checker APPROVE-WITH-NOTES
- **Do not regress:** what must stay (e.g. channel must be created at startup, not lazily)
- **Open risks / deferred:** what is still pending
```

## Example — VERIFIED — calling loop (Phase 1)

- Two devices join the same room and exchange audio/video in foreground. Proved the realtime plumbing end to end. Touch points: `backend/.../token/route.ts`, `core/calling/*`.

## Example — VERIFIED — pairing (Phase 2)

- Simple device shows QR (5-min JWT); admin scans → `POST /api/pairing` links IDs. Pairing record created; both devices know each other.

Copy the template for each phase exit. Mark STALE when outdated; never silently delete.
