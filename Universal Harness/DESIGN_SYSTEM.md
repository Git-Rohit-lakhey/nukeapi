# NukeAPI — Design System

NukeAPI is a developer tool, not consumer SaaS. Its design language is dark, monospace-adjacent, lime-accented — built for engineers who live in terminals and API docs.

---

## Shared Foundations

**Color palette (freeze these — do not drift):**

| Token | Hex | Use |
|---|---|---|
| `color.bg` | `#0a0a0c` | app background |
| `color.surface` | `#111114` | cards, sheets, dashboard panels |
| `color.border` | `#1e1e24` | card borders, dividers |
| `color.borderHover` | `#2c2c36` | hover borders |
| `color.text.primary` | `#d8d8d8` | primary text |
| `color.text.secondary` | `#686878` | secondary / body |
| `color.text.muted` | `#484858` | muted / de-emphasized |
| `color.text.faint` | `#383840` | faint / timestamps |
| `color.accent` | `#c8ff00` / `#c8f135` | lime — links, primary actions, success |
| `color.accentBg` | `rgba(200,241,53,.06)` | accent wash backgrounds |
| `color.success` | `#50c050` | confirm / deleted |
| `color.danger` | `#e06060` | destructive / failed |
| `color.warning` | `#d4943a` | maintenance / pending |
| `color.purple` | `#a855f7` | Enterprise tier accent |
| `color.code.bg` | `#0d0d10` | code blocks |
| `color.code.border` | `#181820` | code block borders |

**Spacing unit:** `4px`. All spacing values multiples of 4 (4, 8, 12, 16, 24, 32, 48, 64, 96). Add a token before inlining a one-off value.

**Typography**
- Body: `16px`, secondary `14px`, small `13px`, eyebrow `12px` (uppercase, letter-spacing .08em)
- Headings: `clamp(1.9rem,3vw,2.6rem)` section h2, `clamp(2.6rem,5.5vw,4.8rem)` hero h1, weight 800–900, letter-spacing -.03em
- Code: `'SF Mono','Fira Code','Consolas',monospace` — every code sample, endpoint label, and integration badge uses monospace
- Legal/marketing body: `14px`, line-height 1.8–1.85, color `#585868` on dark

**Motion**
- `pulse` — lime dot breathing (2s)
- `fadeUp` — hero entrance (.55s ease)
- `slideIn` — log rows (.35s ease)
- Hover lifts: `transform: translateY(-2px)` + border-color shift

---

## Components

**Cards**
- `background: #111114`, `border: 1px solid #1e1e24`, `border-radius: 14–16px`, `padding: 24–32px`
- Hover: `border-color: #2c2c36`, `transform: translateY(-2px)` (pricing/feature cards)
- Enterprise card: `background: #0e0814`, `border: rgba(168,85,247,.5)`, purple glow shadow
- Featured (Startup) card: `background: #0d1600`, `border: rgba(200,241,53,.45)`

**Pills / Badges**
- Integrations pill: `background: #111114`, `border: 1px solid #1e1e24`, `border-radius: 100px`, `padding: 10px 20px`, font 14px
- Live badge: `background: rgba(200,241,53,.2)`, `color: #c8f135`, `padding: 2px 8px`, `border-radius: 4px`, `font-size: 11px`, `letter-spacing: .06em`
- Tag badge: `background: #181820`, `color: #303038`
- Maintenance badge: `background: rgba(245,166,35,.12)`, `color: #f5a623`

**Buttons**
- Primary (`bp`): `background: #c8ff00`, `color: #000`, `border-radius: 10px`, `padding: 14px 28px`, `font-size: 15px`, weight 700
- Ghost/secondary (`bg`): `background: transparent`, `border: 1px solid #1e1e24`, `color: #d8d8d8`
- Tab: `border-bottom: 2px solid transparent`, active `color: #c8ff00`, `border-bottom-color: #c8ff00`, font 11px, letter-spacing .04em

**Code Block**
- Container: `background: #0d0d10`, `border: 1px solid #1e1e24`, `border-radius: 16px`, `overflow: hidden`
- Tab bar: `border-bottom: 1px solid #181820`
- Pre: `padding: 24px`, `font-size: 13px`, `line-height: 1.85`, `color: #8080a0`
- Response bar: `background: #0a0a0d`, `border-top: 1px solid #181820`, `padding: 16px 24px`

**Navigation**
- Sticky nav: `background: rgba(10,10,12,.85)`, `backdrop-filter: blur(12px)`, `border-bottom: 1px solid #1e1e24`
- Links: `color: #686878`, hover `color: #d8d8d8`, active lime
- `::selection { background: #c8ff00; color: #000 }`
- Scrollbar: `width: 5px`, thumb `#222`

---

## Layout / Grid

- Max inner width: `1080px`, `margin: 0 auto`, horizontal padding `6%`
- Section padding: `96px 6%` (alt sections `background: #080809`)
- Two-col grid: `gridTemplateColumns: "1fr 1fr"`, gap `80px` (hero), `48px` (code demo), `64px` (compliance)
- Pricing grid: `repeat(auto-fit,minmax(220px,1fr))`, gap `18px`, flex `1` for equal height
- Stack to `1fr` at `max-width: 768px` (media query `.g2,.g3,.fg{grid-template-columns:1fr!important}`)

---

## Hard Rules (pass/fail on diff review)

1. No light theme — dark only. No second accent color beyond lime/purple.
2. No rounded-3xl / bubbly consumer radii — `8px` controls, `12–16px` cards, `100px` pills only.
3. Code samples always monospace, never proportional — same font stack as `app/globals.css`.
4. Pricing numbers always from `lib/constants/compliance.ts` (or props derived from it) — never hardcoded in JSX.
5. Legal figures (GDPR/CCPA/LGPD) always from `LEGAL` object — never inlined strings that can drift.
6. Integration names/badges always from `CONNECTOR_META` or availability API — never a stale inline array that diverges from the registry.
7. Every interactive element has hover/active states — no dead-feeling buttons.

## Documented Exceptions

- (none yet — when you add one, date it, state who approved, and note the exact files)
