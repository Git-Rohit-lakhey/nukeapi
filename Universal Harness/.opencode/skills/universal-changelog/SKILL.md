# Universal Changelog Skill

Enforce the verified-behavior record on every task. Use on every turn — before writing code, after finishing, and before claiming anything works.

## When to use

- Before touching any file: re-read `CHANGELOG.md` `VERIFIED` entries that cover that file. Preserve them.
- After any behavior-affecting change: append/update a `VERIFIED` entry in the same turn. No verification = no edit to this file.
- Before reporting done: run the self-check below.

## Templates

### VERIFIED entry

```md
## VERIFIED — {{feature}} (Phase {{N}}, added {{DATE}})

- **Request:** ...
- **Implementation:** ... (files, tokens)
- **Verified {{DATE}} (real devices):** ... (logs, dumpsys, HTTP status, screencap)
- **Gates:** typecheck 0 errors; lint 0 errors (N warnings); build SUCCESSFUL
- **Subagent reviews:** @ux-guardian APPROVE / @reliability-checker APPROVE-WITH-NOTES
- **Do not regress:** ... (what must stay)
- **Open risks / deferred:** ...
```

### STALE

If a verification is outdated, mark it `STALE {{DATE}}` with reason — never silently delete.

## Self-check before "done"

- [ ] Re-read `CHANGELOG.md` entries that touch changed files
- [ ] No `VERIFIED` behavior was regressed without re-verification
- [ ] New behavior has a new `VERIFIED` entry with real device/log evidence
- [ ] `STALE` is used where a verification is outdated, not deleted

If any box is unchecked, the task is not done.
