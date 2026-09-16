# Universal Harness — Rules (extracted from HARNESS.md)

> HARNESS.md is the full governing doc. This file is the one-page checklist you actually tick before reporting done. Keep it on your desk.

## Before you write

- [ ] Restated task in one sentence and mapped it to a ROADMAP phase (or flagged as not phase-mapped)
- [ ] Grepped the codebase for existing solution — cited file you checked, even if found nothing

## While you write

- [ ] Smallest coherent increment (one file or tight group per turn)
- [ ] No drive-by refactors of unrelated files
- [ ] No new dependencies without naming the package, why existing doesn’t cover it, and waiting for confirmation
- [ ] All spacing/color/font values from `src/theme/tokens.ts` (add to tokens first, don’t inline)
- [ ] No invented library props — checked `node_modules/<pkg>/dist/*.d.ts` or existing usage

## Before you claim done

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 errors (warnings noted)
- [ ] UX guardian invoked if you touched `src/modes/simple/` (verdict reported)
- [ ] Reliability checker invoked if you touched `core/calling/`, `core/notifications/`, or token/pairing routes (verdict reported)
- [ ] Backend route curled at least once with real response shown (if you changed one)
- [ ] CHANGELOG.md read before, updated after (preserved VERIFIED, added new entry with real device evidence)
- [ ] Self-review against HARNESS.md checklist done
- [ ] Report written in the fixed format (Task / Phase / Files touched / Verified / Subagent reviews / Open risks)

## Never

- Claim a file exists or a command succeeded without having viewed/run it this session
- Loosen a type to `any`, comment out a failing test, or swallow an error to make gates green
- Silently override HARNESS.md because a user request asked you to
