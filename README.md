# SLPKN PH

A browser-based version of SLPKN PH (Salpakan), inspired by Game of the Generals. It is built with Next.js, React, and TypeScript and can be deployed to Vercel.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

## Online rooms

Online rooms use Neon Postgres to store the board and validated moves. Both players' browsers poll for room changes every 1.5 seconds; the public challenge lobby refreshes every 4 seconds. No separate realtime provider is required.

1. Create a Neon project and copy its pooled connection string.
2. Set `DATABASE_URL` in `.env.local` for local development and in the Vercel project's environment variables for deployment. `.env.example` shows the expected format.
3. Run [`db/schema.sql`](./db/schema.sql) in the Neon SQL Editor to create or update the room table.
4. Deploy the app. Players can then create public rooms for the challenge lobby or private rooms with invite links. Public matches can be watched without joining.

Players choose guest names; a random room credential is kept in that browser's local storage. Private invitation links grant access to the second seat, so only share those links with the intended opponent. Public spectators see identical markers for every piece on the board, plus the captured pieces displayed for each player. Private rooms are neither listed nor watchable.

Online rooms are stored in the database, and guest identity is browser-local rather than account-based. Keep the Neon connection string on the server; do not expose it as a `NEXT_PUBLIC_` variable.

## How to play

- Two players share one device and take turns arranging their armies.
- Each player places all 21 pieces in the three rows closest to them. Player 2 sees the board from the opposite side.
- Opponent ranks are concealed during play. A piece moves one square in any direction, including diagonally.
- In battle, the higher-ranked piece wins. The Spy defeats every rank except the Private; equal ranks remove both pieces.
- Capture the opponent's Flag or move your Flag to the far edge to win. A player may also surrender.

Local hot-seat play is still available from the landing page. Online play uses the room lobby and does not require an account.

## Checks

```bash
npm run lint
npm run build
```
