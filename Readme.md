# StaKlaimer: Stealth Auto-Claim Engine

Professional Stake bonus auto-claim suite with Telegram monitoring, stealth browser injection, and SaaS-ready payments.

## 🚀 Key Features
- **0.5ms Speed**: Ultra-fast DOM manipulation via stealth browser injection.
- **Telegram Scraper**: Direct MTProto connection to monitor hundreds of channels.
- **Stealth Mode**: Playwright-based browser automation that bypasses common bot detection.
- **Payments Ready**: Integrated with NOWPayments for USDT (BSC/TRON).
- **Dual DB Support**: SQLite for local testing, Postgres for cloud (Railway).

## 📂 Project Structure
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
   - `NOWPAYMENTS_API_KEY`: For SaaS payments.
   - `NOWPAYMENTS_IPN_SECRET`: For payment verification.
   - `BASE_URL`: Your Railway app URL.

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
