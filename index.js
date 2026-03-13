require('dotenv').config();
const db = require('./backend/db');
const serverInit = require('./backend/server.js');
const { initBot } = require('./backend/bot.js');
const scraperInit = require('./scraper/scraper.js');
const launcher = require('./backend/launcher.js');

async function main() {
    console.log('--- StaKlaimer SaaS Initializing ---');

    try {
        // 1. Initialize Database
        console.log('🐘 Initializing Database...');
        await db.init();
        console.log('✅ Database Ready');

        // 2. Initialize the Vanguard Backend Server
        if (typeof serverInit === 'function') {
            serverInit();
        }

        // 3. Initialize Telegram Bot
        initBot();

        // 4. Start Scraper
        if (typeof scraperInit === 'function') {
            scraperInit();
        }

        // 5. Start Automated Phantom Browser (The "Headless" Claimer)
        if (process.env.ENABLE_AUTOMATED_CLAIMER === 'true') {
            launcher.launchApp().catch(err => {
                console.error('❌ Failed to launch browser:', err);
            });
        }

        console.log('🚀 StaKlaimer SaaS Engine Fully Processed');
        console.log('🌍 Public URL:', process.env.BASE_URL || 'Not Set');
        console.log('------------------------------------');

    } catch (err) {
        console.error('❌ CRITICAL STARTUP ERROR:', err);
        process.exit(1);
    }
}

main();
