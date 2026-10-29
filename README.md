# SLPKN PH

A browser-based, local two-player version of SLPKN PH, inspired by Game of the Generals. It is built with Next.js, React, and TypeScript and can be deployed to Vercel.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

## How to play

- Two players share one device and take turns arranging their armies.
- Each player places all 21 pieces in the three rows closest to them. Player 2 sees the board from the opposite side.
- Opponent ranks are concealed during play. A piece moves one square in any direction, including diagonally.
- In battle, the higher-ranked piece wins. The Spy defeats every rank except the Private; equal ranks remove both pieces.
- Capture the opponent's Flag or move your Flag to the far edge to win. A player may also surrender.

This version runs entirely in the browser: it does not have online multiplayer, accounts, or a server-side game service. For local hot-seat play, pass the device to the other player during setup and between turns.

## Checks

```bash
npm run lint
npm run build
```
