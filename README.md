# GOPS 🎴 — Game of Pure Strategy

A browser implementation of **GOPS** (also known as Goofspiel), a 2-player
bidding card game built entirely on nerve, bluffing, and card counting —
no luck involved once the cards are dealt.

Play hot-seat on one device: pass it back and forth between rounds.

## Objective

Win the highest total score by bidding smartly.

## Setup

- One suit is set aside as the **prize deck**.
- Each player gets their own full suit, numbered Ace–10 (or Ace–King for a
  longer game).
- Both players hold identical cards.

## How to play

1. Flip one prize card face up in the center.
2. Both players secretly choose one card from their hand to bid.
3. Bids are revealed at the same time.
4. The higher bid wins the prize card.
5. On a tie, the prize carries over and stacks with the next round's prize.
6. Every bid card is discarded after use — each card can only be played once.

## Scoring

Add up the value of every prize card you won. Highest total score wins the
game!

## Strategy

- Big bid now, or save it for later?
- Bluff on low-value rounds to save your strong cards.
- Track which cards your opponent has already used.
- No luck after the flip — just mind games. 😈

## Running locally

```bash
npm install
npm run dev
```

Then open the printed local URL in your browser.

## Building for production

```bash
npm run build
npm run preview
```

The static output is written to `dist/` and can be deployed to any static
host (GitHub Pages, Netlify, Vercel, etc).

## Tech stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for dev server and bundling
- No backend, no external dependencies at runtime — pure client-side game
  logic (see [`src/game.ts`](./src/game.ts))

## Contributing

Issues and pull requests are welcome! Some ideas for contributions:

- Online/remote multiplayer (instead of hot-seat)
- AI opponent for solo play
- Animations for the reveal
- Game history / replay view

## License

[MIT](./LICENSE)
