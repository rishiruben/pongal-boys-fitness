# Pongal Boys Fitness

A self-hosted fitness and nutrition challenge board with automated Strava workout syncing and a nightly AI-evaluated daily scoring pipeline.

## Features

- **Challenge Leaderboard (`/api/leaderboard`):** Tracks participant standings and daily scores.
- **Activity & Nutrition Logging (`/api/log`):** Logs daily workouts and nutrition entries.
- **Strava OAuth & Sync (`/api/strava/auth`, `/api/strava/callback`, `/api/strava/sync`):** Automatically imports workouts from Strava, with built-in **Simulator Mode** when Strava API credentials are left blank for local testing.
- **Participant Management (`/api/users`):** Manage challenge participants and profiles.
- **Nightly AI Scoring Pipeline:** CLI scripts export daily logs as an evaluation prompt and ingest structured JSON scores back into SQLite.

## Tech Stack

- **Framework:** Next.js 16 + React 19 + TypeScript
- **Database:** SQLite via Prisma 7 (`@prisma/adapter-better-sqlite3` & `better-sqlite3`)

## Quick Start (Local Development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:
   ```env
   DATABASE_URL="file:./dev.db"
   NEXT_PUBLIC_BASE_URL="http://localhost:3000"

   # Optional: leave blank to run in Simulator Mode
   STRAVA_CLIENT_ID=""
   STRAVA_CLIENT_SECRET=""
   ```

3. Generate the Prisma client and initialize the SQLite database:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. *(Optional)* Seed sample participants and workouts:
   ```bash
   npm run seed
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Nightly AI Scoring Scripts

- `npm run evaluate-day` — Generates the evaluation prompt for yesterday's logs (or pass a date: `npm run evaluate-day -- 2026-08-15`).
- `npm run save-scores -- ./temp_scores.json` — Saves evaluated JSON scores into SQLite.
- `npm run test-loop` — Exercises the AI scoring loop locally.

For full Ubuntu production hosting with PM2, Cloudflare Tunnel, and cron automation, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## License

MIT — see [LICENSE](./LICENSE) for details.
