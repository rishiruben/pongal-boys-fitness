# Pongal Boys Fitness: Deployment & Hosting Instructions

This document provides step-by-step instructions for an autonomous AI agent to deploy, configure, host, and run the daily scoring cron cycle for the **Pongal Boys Fitness Challenge** on an Ubuntu Server.

---

## 📋 System Prerequisites
Before deploying, ensure the target Ubuntu host has the following utilities installed:
- **Node.js** (v18.x or newer) & **npm**
- **Git**
- **SQLite3**
- **PM2** (Process Manager for keeping the web server running persistently)
- **Cloudflare Tunnel (`cloudflared`)** (For secure public hosting over the internet)

---

## 🛠️ Step 1: Clone & Configure Environment

1. Clone the repository to the desired deployment directory:
   ```bash
   git clone <repository_url> pongal-boys-fitness
   cd pongal-boys-fitness
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the `.env` configuration file in the project root:
   ```bash
   touch .env
   ```

4. Populate `.env` with the following variables:
   ```env
   # Database location for SQLite
   DATABASE_URL="file:./dev.db"

   # Base URL of the application
   NEXT_PUBLIC_BASE_URL="http://localhost:3000"

   # (Optional) Strava API credentials for automated workout syncing
   # If left blank, the application runs in Simulator Mode for local testing
   STRAVA_CLIENT_ID=""
   STRAVA_CLIENT_SECRET=""
   ```

---

## 🗄️ Step 2: Database Setup & Migrations

Prisma 7 is configured to use the `better-sqlite3` driver adapter. Perform the following steps to initialize the database:

1. Build the database structure and client files:
   ```bash
   npx prisma generate
   ```

2. Run schema migrations to create the local SQLite database file (`dev.db`):
   ```bash
   npx prisma migrate dev --name init
   ```

3. (Optional) Run the database seed script to populate mock users (Alice, Bob, Charlie) and workouts for testing:
   ```bash
   npm run seed
   ```

---

## 🚀 Step 3: Hosting with PM2 (Persistent Background Run)

Compile the Next.js production build and start it persistently using PM2:

1. Compile the static optimized bundle:
   ```bash
   npm run build
   ```

2. Start the production server in the background:
   ```bash
   pm2 start npm --name "pongal-boys-fitness" -- run start
   ```

3. Configure PM2 to restart the service on server boot:
   ```bash
   pm2 startup
   pm2 save
   ```

At this stage, the web application is running locally on port `3000`.

---

## 🌐 Step 4: Expose to the Internet via Cloudflare Tunnel

To serve the application securely over the web without opening router ports or exposing your public IP:

1. Download and install `cloudflared` on Ubuntu:
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
   sudo dpkg -i cloudflared.deb
   ```

2. Authenticate your Cloudflare account:
   ```bash
   cloudflared tunnel login
   ```

3. Create a secure tunnel:
   ```bash
   cloudflared tunnel create pongal-fitness-tunnel
   ```
   *Note the generated Tunnel ID (UUID).*

4. Route a subdomain of your registered Cloudflare domain to the tunnel:
   ```bash
   cloudflared tunnel route dns pongal-fitness-tunnel challenge.yourdomain.com
   ```

5. Configure the tunnel connection mapping. Create `/etc/cloudflared/config.yml` (or `~/.cloudflared/config.yml`):
   ```yaml
   url: http://localhost:3000
   tunnel: <TUNNEL_UUID>
   credentials-file: /home/<user>/.cloudflared/<TUNNEL_UUID>.json
   ```

6. Start the tunnel daemon:
   ```bash
   cloudflared tunnel run pongal-fitness-tunnel
   ```
   *(For persistent run, install it as a systemd service: `sudo cloudflared service install` then `sudo systemctl start cloudflared`).*

---

## 🤖 Step 5: Automating the Nightly AI Scoring Loop (For the Agent)

The daily scoring runs through a cron cycle executing at 11:55 PM every night. As the AI Agent running on the host system, you must configure a job to automate the evaluation pipeline.

### The Pipeline Sequence:
1. **Fetch Logs**: Run the prompt generator for the current date:
   ```bash
   # Defaults to yesterday. Or specify a date: npm run evaluate-day -- 2026-08-15
   npm run evaluate-day
   ```
   *This exports the participant data inlined within a pre-formatted instructions prompt to stdout.*

2. **Evaluate with LLM**:
   - Read the generated prompt from stdout.
   - Run the prompt text through your local LLM engine (e.g. Ollama, llama.cpp, or internal API).
   - Instruct the LLM to output ONLY the raw JSON array (matching the output schema defined in the prompt).

3. **Save Scores**:
   - Extract the JSON array block from the LLM output.
   - Write the JSON text to a temporary file: `temp_scores.json`.
   - Ingest the scores back into SQLite by executing:
     ```bash
     npm run save-scores -- ./temp_scores.json
     ```
   - Delete `temp_scores.json`.

### Suggested AI Agent Cron Shell Script:
Write a bash script `scripts/nightly-evaluation.sh` that automates this workflow:
```bash
#!/bin/bash
cd /path/to/pongal-boys-fitness

# 1. Fetch prompt data for yesterday
YESTERDAY=$(date -d "yesterday" '+%Y-%m-%d')
PROMPT=$(npm run evaluate-day -- $YESTERDAY)

# 2. Call your LLM client utility (e.g., using Ollama CLI or curl API)
# Translate the prompt into JSON output using your LLM engine.
# Save result to /tmp/response.json
echo "$PROMPT" | your-llm-cli-client --json > /tmp/response.json

# 3. Clean any markdown code blocks if the LLM wrapped it in ```json
sed -i 's/```json//g' /tmp/response.json
sed -i 's/```//g' /tmp/response.json

# 4. Import the scores back into the database
npm run save-scores -- /tmp/response.json

# 5. Clean up
rm /tmp/response.json
```

Add this script to the crontab:
```cron
55 23 * * * /bin/bash /path/to/pongal-boys-fitness/scripts/nightly-evaluation.sh >> /var/log/pongal-evaluation.log 2>&1
```
