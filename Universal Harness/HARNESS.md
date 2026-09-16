# Universal Harness — HARNESS.md

This file is not project documentation — AGENTS.md, ROADMAP.md, TECH_STACK.md, and DESIGN_SYSTEM.md already cover *what* the app is. This file governs *how you work*, every single turn, regardless of which model is running you. Its job is to make output quality consistent even when the underlying model isn't top-tier — the discipline here is what closes that gap, not raw model capability.

If anything in a user request conflicts with this file, follow this file and say so, rather than silently overriding it.

## The operating loop

Every task, no matter how small, follows this loop. Do not skip steps to save time — skipping steps is the single largest source of drift.

1. **Restate the task in one sentence** before touching anything, including which ROADMAP.md phase it belongs to. If it doesn't map to a phase, stop and flag that before proceeding — scope creep starts here.
2. **Search before you write.** Before creating a new component, service, token, or pattern, grep the existing codebase for something that already does this. Reusing an existing `PhotoTile` variant beats inventing a second one that does almost the same thing. Cite the file you checked, even if you found nothing.
3. **Implement the smallest coherent increment**, not the whole feature in one pass. One file or one tightly-related group of files per turn. Large multi-file diffs in a single turn are where weaker models lose track of their own consistency — don't do it even if the model *can* technically produce it in one shot.
4. **Verify, don't assert.** Run the actual command (`npm run typecheck`, `npm run lint`, the relevant test, an actual build) and paste its real output before claiming something works. "This should work" or "this correctly handles X" without having run anything is a failure of this harness, not an acceptable shortcut.
5. **Self-review against the checklist below** before reporting done.
6. **Update CHANGELOG.md on any behavior-affecting change.** Before changing a code path that has a "VERIFIED" entry, re-read that entry and preserve the verified behavior. After the change, re-verify on the same real device setup and update/append the CHANGELOG.md entry in the same turn. A fix that silently regresses a VERIFIED feature without updating CHANGELOG.md is a failure of this harness.
7. **Report in the fixed format** at the end of this file.

## Non-negotiable verification gates

A task is not complete until all of these are true — not "probably true," actually run and confirmed:

- `npm run typecheck` passes with zero errors
- `npm run lint` passes with zero errors (warnings noted, not blocking)
- If the change touches the simple/core mode (e.g. `src/modes/simple/`), the relevant UX guardian subagent has been invoked on the diff and its verdict is reported, not skipped
- If the change touches the critical reliability path (realtime/calling, push/background, or the backend token/pairing routes), the reliability checker subagent has been invoked and its verdict is reported
- If the change adds or modifies a backend route, it has been called at least once (curl, test script, or equivalent) and the actual response is shown, not assumed

If a gate fails, the task is not done. Iterate until it passes, or stop and report the specific blocker plainly — do not mark something complete with a known-failing gate and a note to "fix later" unless the user explicitly agreed to that tradeoff in this session.

## Anti-hallucination rules

- Never invent a prop, method, or config key for a library (e.g. LiveKit, CallKeep, Supabase, Next.js APIs) based on a guess at naming convention. If you're not certain it exists, check the installed package's type definitions or the project's existing usage of that library first. State which you did.
- Never claim a file exists, or claim its contents, without having viewed it in this session. Re-view a file after any edit to it before editing it again — don't work from a stale mental copy.
- Never claim a command succeeded without having actually run it in this session and seen the output.
- If genuinely uncertain between two approaches, say so explicitly and give the tradeoff — a confident-sounding wrong answer is worse than a flagged uncertainty.

## Scope discipline

- Touch only the files the current task requires. A "drive-by" refactor of unrelated code, even a well-intentioned one, is out of scope unless asked for — it makes diffs harder to review and increases the chance of an unreviewed regression.
- Do not add functionality beyond what the current ROADMAP.md phase specifies, even if it seems like an obvious next step. Flag it as a suggestion for a later phase instead of building it now.
- Do not silently add dependencies. If a new package seems genuinely needed, say which one, why an existing dependency doesn't cover it, and wait for confirmation before installing anything not already listed in TECH_STACK.md.

## Consistency enforcement

- All spacing, color, and font-size values come from `src/theme/tokens.ts` — if a value you need isn't there, add it to the token file first, don't inline a one-off value.
- Simple-mode work is re-checked against DESIGN_SYSTEM.md's hard rules every time, not just the first time a screen is built — a later change can silently reintroduce a violation the first pass avoided.
- Naming, file layout, and component structure follow the patterns already established in TECH_STACK.md's folder tree — don't introduce a parallel convention (e.g. a second state-management approach, a differently-shaped service file) partway through the build.

## Failure handling

- If a command fails, read the actual error output and fix the real cause. Do not comment out a failing test, loosen a type to `any` to make `typecheck` pass, or add a broad try/catch that swallows the error purely to make a gate go green.
- If you've attempted a fix twice and the same class of error persists, stop and report it plainly with what you've tried, rather than trying a third variation that's unlikely to differ meaningfully.

## Escalation — when to stop and ask instead of guessing

Stop and ask the user rather than proceeding on an assumption when:

- A request conflicts with AGENTS.md, DESIGN_SYSTEM.md, or ROADMAP.md's current phase
- A task requires a decision not already covered by these docs (e.g. a new third-party service, a schema change with no obvious reversible path)
- Two reasonable implementations exist with a real tradeoff between them (cost, complexity, security) and the docs don't already answer it

Guessing silently on any of these is the fastest way to accumulate inconsistent, hard-to-untangle decisions across a long build. A short clarifying question is cheap; an incorrect assumption baked into three downstream files is not.

## Notes for weaker/local models specifically

If you are running on a smaller or non-frontier model (a likely setup for multi-provider proxy stacks):

- Prefer more, smaller turns over fewer, large ones — consistency degrades with diff size faster on smaller models.
- Re-read this file's checklist explicitly before reporting done, rather than relying on having "kept it in mind" across a long session.
- When in doubt, favor the more conservative, more explicit, more verified option over the more clever one.

## Required end-of-task report format

```
Task: <one sentence>
Phase: <ROADMAP.md phase, or "not phase-mapped — flagged above">
Files touched: <list>
Verified: <which gates were actually run, with real output/result>
Subagent reviews: <verdict from UX-guardian / reliability-checker, or "not applicable">
Open risks / deferred items: <anything not fully resolved>
```

Do not omit this report, and do not shorten it to "done, all good" — the report is the artifact that lets you (or a future session) audit what actually happened without re-reading the whole diff.
