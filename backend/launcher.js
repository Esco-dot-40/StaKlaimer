require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

async function launchApp() {
    const isHeadless = process.env.HEADLESS !== 'false';
    console.log(`🌐 Launching Phantom Browser (Headless: ${isHeadless})...`);
    
    chromium.use(stealth);

    // Use a persistent context so the user stays logged into Stake
    const userDataDir = path.join(process.cwd(), 'user_data');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir);

    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: isHeadless,
        viewport: isHeadless ? { width: 1280, height: 720 } : null,
        args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    const page = await browser.newPage();
    
    // Forward browser console logs to terminal (with noise filtering)
    page.on('console', msg => {
        const text = msg.text();
        if (text.startsWith('%c%d')) return; // Filter Stake anti-tamper noise
        console.log(`[Browser] ${text}`);
    });
    
    // Inject the claimer logic directly into the page
    const claimerPath = path.join(__dirname, '../shared/claimer.user.js');
    const claimerCode = fs.readFileSync(claimerPath, 'utf8');
    
    const PORT = process.env.PORT || 3000;
    await page.addInitScript((port) => {
        // We override the WS URL to localhost for the internal server
        window.PHANTOM_INTERNAL_SERVER = `ws://localhost:${port}`;
    }, PORT);

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

if (require.main === module) {
    launchApp().catch(err => {
        console.error('❌ Failed to launch:', err);
    });
}

module.exports = { launchApp };
