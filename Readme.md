# StaKlaimer: Stealth Auto-Claim Engine

Professional Stake bonus auto-claim suite with Telegram monitoring, stealth browser injection, and SaaS-ready payments.

## 🚀 Key Features
- **0.5ms Speed**: Ultra-fast DOM manipulation via stealth browser injection.
- **Telegram Scraper**: Direct MTProto connection to monitor hundreds of channels.
- **Stealth Mode**: Playwright-based browser automation that bypasses common bot detection.
- **Payments Ready**: Integrated with NOWPayments for USDT (BSC/TRON).
- **Dual DB Support**: SQLite for local testing, Postgres for cloud (Railway).

## ✅ Current Status (Stable)
- **DB Fixed**: SQLite initialization for local development is now robust.
- **Launcher Unified**: `backend/launcher.js` and `index.js` now work together without port conflicts.
- **Stealth Enhanced**: Added noise filtering for browser logs and improved element discovery.
- **Automated Claimer**: Fully integrated into the server start flow.
- **Deep-Wake Engine**: Added silent audio and no-throttle flags for background stability.

## 🤖 Solo Mode: 100% Background
To run the bot without it using any screen space:
1.  **Initial Login**: Run once with `HEADLESS=false` in `.env` to log into Stake.
2.  **Go Background**: Change to `HEADLESS=true` in `.env`.
3.  **Use Your PC**: The bot will run entirely in the background. You can minimize the terminal or run it as a service. It will NOT throttle or go to sleep even if you are gaming or working in other windows.
4.  **Monitor via Bot**: Use the Telegram bot's `/screen` command to see what the background browser is seeing at any time.
- `/backend`: Node.js Express API + Telegram Bot (Telegraf).
- `/scraper`: Telegram user-bot scraper (gramjs).
- `/frontend`: Marketing landing page for the service.
- `/shared`: Browser userscript logic and build tools.

## 🛠️ Local Setup
1. Clone the repo.
2. Run `npm install` in the root (and in `/backend`).
3. Fill in your `.env` with Telegram API credentials and Bot token.
4. Run `node backend/launcher.js` to start the app.
5. Use `shared/build.bat` to compile `StakeClaimer.exe`.

## 🚂 Railway Deployment
1. Connect this repo to a new Project on Railway.
2. Add a **Postgres** service to the project.
3. Railway will automatically inject the `DATABASE_URL`.
4. Add the following Variables to your Railway service:
   - `TELEGRAM_TOKEN`: Your bot token from BotFather.
   - `TELEGRAM_API_ID` & `TELEGRAM_API_HASH`: From my.telegram.org.
   - `TELEGRAM_SESSION`: Session string (generated locally).
   - `NOWPAYMENTS_API_KEY`: For SaaS payments.
   - `BASE_URL`: Your Railway app URL.
   - `HEADLESS`: set to `true` (default).
   - `ENABLE_AUTOMATED_CLAIMER`: set to `false` for SaaS, `true` for Solo.

## 🔍 Diagnostics
Run `node debug_env.js` locally to check your configuration before pushing.
If you get a 502 on Railway, check that `HEADLESS` is not set to `false`.

## 📤 Pushing to Your Repo
Open a terminal in the root and run:
```bash
git init
git remote add origin https://github.com/Esco-dot-40/StaKlaimer.git
git add .
git commit -m "Initial Build: Stake Stealth Claimer SaaS"
git branch -M main
git push -u origin main
```

## ⚠️ Credits & Legal
This project is for educational/private use. Always respect Stake's Terms of Service.
Developed by Antigravity.
