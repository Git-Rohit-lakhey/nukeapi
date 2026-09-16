# Universal Verification Skill

Run verify-before-claiming-done gates correctly on real devices. Use before reporting any task complete.

## Gates (customize per stack, keep the shape)

1. **Typecheck:** `npm run typecheck` (or `npx tsc --noEmit`) — must be 0 errors
2. **Lint:** `npm run lint` — 0 errors (warnings noted, not blocking)
3. **Build:** your platform build with production flags (e.g. `gradlew assembleRelease` or `next build`) — must be BUILD SUCCESSFUL
4. **Backend route:** if you touched a backend route, `curl` it at least once and paste the real response (status + body), not assumed
5. **Device:** if you touched the simple/core mode or realtime/push, test on at least one physical device (not just emulator) and capture evidence

## Device evidence (pick the reliable signal per OS)

- **Ring / notification:** `dumpsys notification --noredact` (shows channel, importance, sound, vibration) + `dumpsys telecom` (shows RINGING). On MIUI/ColorOS, `uiautomator` may not read the overlay — use screencap pixel analysis or behavioral tap instead.
- **Overlay visible:** screencap + pixel diff vs baseline + tap at the button center to confirm it answers.
- **Logs:** `logcat -s ReactNativeJS` for JS-side push/webrtc lines; `run-as` is unavailable on release builds — seed/inspect on debug first.
- **Quotas:** `LOG_FLOWCTRL` can drop log lines at startup — clear logcat before E2E and use notification dumps as the reliable signal.

## Commands (adapt)

```
npm run typecheck
npm run lint
# mobile
gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a
adb install -r app-debug.apk
adb logcat -c; adb shell am start -n com.{{app}}/.MainActivity
adb shell dumpsys notification --noredact | grep -i {{app}}
# backend
npx tsc --noEmit  # in backend/
curl -s -X POST https://{{app}}.vercel.app/api/pairing/token -d '{"deviceId":"test-123"}' -H "Content-Type: application/json"
curl -s "https://{{app}}.vercel.app/api/pairing?deviceId=..."
```

## Gate status template (paste into CHANGELOG)

```
- `npm run typecheck` (mobile): PASSES, 0 errors
- `npm run lint` (mobile): 0 errors, 6 warnings
- Backend: `npx tsc --noEmit` PASSES
- Build: `./gradlew assembleDebug` BUILD SUCCESSFUL in 1m18s
- Device: ... (what was observed)
```

If a gate fails, iterate until it passes or stop and report the blocker plainly — do not mark complete with a known-failing gate and a note to "fix later" unless the user explicitly agreed.
