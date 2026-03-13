require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');
const state = require('./state');

let activePage = null;

async function launchApp() {
    const isHeadless = process.env.HEADLESS !== 'false';
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    
    console.log(`🌐 [Engine] Starting Engine (Headless: ${isHeadless}, Railway: ${isRailway})`);
    
    chromium.use(stealth);

    // Dynamic User Data Dir in /tmp for Railway permissions
    const userDataDir = '/tmp/vanguard_browser';
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

    try {
        const browser = await chromium.launch({
            headless: isHeadless,
            executablePath: process.env.CHROME_PATH || undefined, // Optional override
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--single-process',
                '--no-zygote'
            ]
        });

        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });

        const page = await context.newPage();
        activePage = page;
        
        const claimerPath = path.join(__dirname, '../shared/claimer.user.js');
        const claimerCode = fs.readFileSync(claimerPath, 'utf8');
        
        // Ensure browser connects to the correct port
        const PORT = process.env.PORT || 3000;
        await page.addInitScript((port) => {
            window.PHANTOM_INTERNAL_SERVER = `ws://localhost:${port}`;
            console.log(`[Browser] Internal WS set to localhost:${port}`);
        }, PORT);

        page.on('domcontentloaded', async () => {
            console.log('💉 [Engine] Injecting Vanguard Prime...');
            await page.evaluate((code) => {
                const script = document.createElement('script');
                script.textContent = code;
                document.documentElement.appendChild(script);
            }, claimerCode);
        });

        const targetUrl = 'https://stake.com/?tab=offers&modal=redeemBonus';
        console.log(`📡 [Engine] Navigating to ${targetUrl}`);
        
        await page.goto(targetUrl, { waitUntil: 'load', timeout: 90000 });
        
        state.setEngineActive(true);
        console.log('🛡️ [Engine] VANGUARD ONLINE (Solo Mode Ready)');

    } catch (err) {
        state.setEngineActive(false);
        console.error('❌ [Engine] STARTUP FAILED:', err.message);
        throw err;
    }
}

async function takeScreenshot() {
    if (!activePage) return null;
    try {
        return await activePage.screenshot({ type: 'png' });
    } catch (e) {
        console.error('Screenshot failed:', e.message);
        return null;
    }
}

module.exports = { launchApp, takeScreenshot };
