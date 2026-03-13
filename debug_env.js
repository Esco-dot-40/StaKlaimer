require('dotenv').config();
const db = require('./backend/db');
const { initBot } = require('./backend/bot');

async function check() {
    console.log('--- StaKlaimer Diagnostic ---');
    
    // Check DB
    try {
        await db.init();
        console.log('✅ DB Connection/Init: OK');
    } catch (e) {
        console.error('❌ DB Error:', e.message);
    }

    // Check Bot Token Format
    const token = process.env.TELEGRAM_TOKEN;
    if (token) {
        if (/^\d+:[\w-]{35,}$/.test(token)) {
            console.log('✅ Bot Token Format: Valid');
        } else {
            console.warn('⚠️ Bot Token Format: Possibly invalid or truncated');
        }
    } else {
        console.warn('⚠️ Bot Token: Missing');
    }

    // Check Scraper Config
    if (process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH) {
        console.log('✅ Telegram API Credentials: Present');
        if (process.env.TELEGRAM_SESSION) {
            console.log('✅ Telegram Session: Present');
        } else {
            console.warn('⚠️ Telegram Session: Missing (Scraper will be inactive in Cloud)');
        }
    } else {
        console.warn('⚠️ Telegram API Credentials: Missing');
    }

    console.log('--- Diagnostic Complete ---');
}

check();
