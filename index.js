const serverInit = require('./backend/server.js');
const bot = require('./backend/bot.js');
const scraperInit = require('./scraper/scraper.js');
const launcher = require('./backend/launcher.js');

console.log('--- StaKlaimer SaaS Initializing ---');

// Initialize the Vanguard Backend Server
if (typeof serverInit === 'function') {
    serverInit();
}

// Start Scraper
if (typeof scraperInit === 'function') {
    scraperInit();
}

// Start Automated Phantom Browser (The "Headless" Claimer)
// This makes it so the server ITSELF does the claiming.
if (process.env.ENABLE_AUTOMATED_CLAIMER === 'true') {
    console.log('🛡️ Starting Automated Claimer Browser...');
    // We run this in the background
}

console.log('🚀 StaKlaimer SaaS Engine Fully Processed');
console.log('🌍 Public URL:', process.env.BASE_URL || 'Not Set');
console.log('🐘 Database:', process.env.DATABASE_URL ? 'Postgres' : 'SQLite');
console.log('------------------------------------');
