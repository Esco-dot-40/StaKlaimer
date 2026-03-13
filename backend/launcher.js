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
    
    console.log(`🌐 [Engine] Ignition (Headless: ${isHeadless}, Railway: ${isRailway})`);
    
    chromium.use(stealth);

    // Force system library path visibility
    process.env.LD_LIBRARY_PATH = `${process.env.LD_LIBRARY_PATH || ''}:/usr/lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu`;

    try {
        console.log(`🚀 [Engine] Attempting Chromium launch...`);
        
        const browser = await chromium.launch({
            headless: isHeadless,
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
        if (!fs.existsSync(claimerPath)) {
            throw new Error(`Claimer script missing at ${claimerPath}`);
        }
        const claimerCode = fs.readFileSync(claimerPath, 'utf8');
        
        const PORT = process.env.PORT || 3000;
        await page.addInitScript((port) => {
            window.PHANTOM_INTERNAL_SERVER = `ws://localhost:${port}`;
        }, PORT);

        page.on('domcontentloaded', async () => {
            console.log('💉 [Engine] Injecting Vanguard Prime UI...');
            await page.evaluate((code) => {
                const script = document.createElement('script');
                script.textContent = code;
                document.documentElement.appendChild(script);
            }, claimerCode);
        });

        const targetUrl = 'https://stake.com/?tab=offers&modal=redeemBonus';
        console.log(`📡 [Engine] Navigating to Stake...`);
        
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        
        state.setEngineActive(true);
        console.log('🛡️ [Engine] ONLINE & MONITORING');

    } catch (err) {
        state.setEngineActive(false);
        console.error('❌ [Engine] STARTUP FAILED:', err.message);
        console.log('💡 TIP: If you see "libglib" error, wait for the latest build to finish installing dependencies.');
        throw err;
    }
}

async function takeScreenshot() {
    if (!activePage) return null;
    try {
        return await activePage.screenshot({ type: 'png' });
    } catch (e) {
        console.error('Screenshot error:', e.message);
        return null;
    }
}

module.exports = { launchApp, takeScreenshot };
