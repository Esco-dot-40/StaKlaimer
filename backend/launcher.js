require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

// Import our server logic (modified to work as a module)
const startServer = () => {
    require('./server.js');
};

const startScraper = () => {
    // Correctly path to the scraper directory
    if (process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH) {
        require('../scraper/scraper.js');
    } else {
        console.log('💡 Scraper skipped: TELEGRAM_API_ID/HASH not found in .env');
    }
};

async function launchApp() {
    console.log('🚀 Starting Stealth Vanguard Backend...');
    startServer();

    console.log('📡 Starting Telegram Scraper...');
    startScraper();

    console.log('🌐 Launching Phantom Browser...');
    
    chromium.use(stealth);

    // Use a persistent context so the user stays logged into Stake
    const userDataDir = path.join(process.cwd(), 'user_data');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir);

    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: false, // Set to true if you want it completely invisible
        viewport: null,
        args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const page = await browser.newPage();
    
    // Inject the claimer logic directly into the page
    const claimerPath = path.join(__dirname, '../shared/claimer.user.js');
    const claimerCode = fs.readFileSync(claimerPath, 'utf8');
    
    await page.addInitScript(() => {
        // We override the WS URL to localhost for the internal server
        window.PHANTOM_INTERNAL_SERVER = 'ws://localhost:3000';
    });

    // Handle Page Crashes/Reloads
    page.on('domcontentloaded', async () => {
        console.log('💉 Injecting Phantom Logic into Stake...');
        await page.evaluate((code) => {
            const script = document.createElement('script');
            script.textContent = code;
            document.documentElement.appendChild(script);
        }, claimerCode);
    });

    // Navigate directly to Stake.
    const targetUrl = 'https://stake.com/?tab=offers&modal=redeemBonus';

    await page.goto(targetUrl);
    
    console.log('🛡️ Vanguard Phantom Active');
    console.log('🌐 Application running on real Stake.com');
    console.log('📡 Listening for incoming codes via WebSocket...');
}

launchApp().catch(err => {
    console.error('❌ Failed to launch:', err);
});
