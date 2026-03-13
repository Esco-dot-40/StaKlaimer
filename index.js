require('dotenv').config();
const serverInit = require('./backend/server.js');
const bot = require('./backend/bot.js');

console.log('--- StaKlaimer SaaS Initializing ---');

// Initialize the Vanguard Backend Server
if (typeof serverInit === 'function') {
    serverInit();
} else {
    console.error('❌ Failed to find server init function.');
}

// Bot is initialized via its own require/launch sequence in bot.js

console.log('🚀 StaKlaimer SaaS Engine Fully Processed');
console.log('🌍 Public URL:', process.env.BASE_URL || 'Not Set');
console.log('🐘 Database:', process.env.DATABASE_URL ? 'Postgres' : 'SQLite');
console.log('------------------------------------');
