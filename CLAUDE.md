# CLAUDE.md

This file gives Claude Code (and other contributors) context on this
repository: what it is, how it's structured, and what's planned next.

## Project overview

GOPS (Game of Pure Strategy / Goofspiel) — a 2-player secret-bidding card
game, playable hot-seat in the browser. Pure client-side React app, no
backend.

- `src/game.ts` — game state machine and rules (pure functions, no React)
- `src/App.tsx` — screens for each phase (setup, prize-reveal, bidding,
  pass-device, reveal, game-over)
- `src/Card.tsx` — reusable card component (face-up/face-down, sizes,
  selected/dimmed states)
- `src/cardLabel.ts` — numeric value → display label (A, 2–10, J, Q, K)
- `src/index.css` — all styling, dark theme, no CSS framework

## Commands

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build locally
```

## Deployment

GitHub Pages via `.github/workflows/deploy.yml`, triggered on push to
`main`. Requires Pages source set to "GitHub Actions" in repo settings
(Settings → Pages → Build and deployment → Source).

## Roadmap / next steps

### 1. Make the UI fun, unique, and usable

Current UI is functional but generic (plain cards, no animation, no
personality). Ideas:
- Real flip/deal animations for the prize reveal and bid reveal
- More distinct visual identity (custom card art or illustration style
  instead of plain suit glyphs)
- Juicier feedback on round wins (confetti, score-tick animation, etc.)
- Sound effects (optional, muteable)
- Better mobile ergonomics for the hot-seat pass-the-device flow

**Status: implemented on `claude/fun-ui`.** Cards now pop in on
appearance and 3D-flip at showdown, round wins trigger a confetti burst
and a pop-in winner banner, and the scoreboard bumps/flashes when a
score changes. Custom card art, sound effects, and further mobile
polish are still open for contribution.

### 2. Play against AI option

Currently 2-player hot-seat only. Add a single-player mode against a
computer opponent:
- Simplest baseline: AI bids a random unused card
- Smarter: AI tracks prize value and remaining hand (both players' hands
  are public since decks are pre-determined) and bids according to a
  strategy (e.g. weight bid to prize value, bluff on low-value rounds)
- Optimal GOPS play is a known game-theory problem (equilibrium bidding
  strategies exist in the literature) — worth referencing if implementing
  a "hard" difficulty
- UI-wise: skip the "pass device" screen entirely when playing vs. AI

**Status: implemented on `claude/ai-opponent`.** Setup screen has a
2-players / vs-AI toggle; in AI mode the pass-device screen is skipped
and the AI bids a card weighted toward the prize's rank in its own
remaining hand, with occasional low bluffs and some randomness. A
literature-backed "hard" (equilibrium) difficulty is still open for
contribution.

Both items are open for further contributions — see the README's
Contributing section too.
