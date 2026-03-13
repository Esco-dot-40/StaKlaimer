require('dotenv').config();
const server = require('./backend/server.js');
const bot = require('./backend/bot.js');

// Start the Vanguard Backend
// If server.js is written as a module, call its init
if (typeof server === 'function') {
    server();
}

console.log('🚀 StaKlaimer SaaS Engine Started');
console.log('🔗 Backend & Bot are now online.');
