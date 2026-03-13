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

    // Force system chromium path if on Railway
    const executablePath = isRailway ? '/usr/bin/chromium' : (process.env.CHROME_PATH || undefined);
    console.log(`🚀 [Engine] Using Browser Path: ${executablePath || 'Playwright Default'}`);

    try {
        const browser = await chromium.launch({
            headless: isHeadless,
            executablePath: executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--single-process'
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
        
        const PORT = process.env.PORT || 3000;
        await page.addInitScript((port) => {
            window.PHANTOM_INTERNAL_SERVER = `ws://localhost:${port}`;
        }, PORT);

        page.on('domcontentloaded', async () => {
            console.log('💉 [Engine] Vanguard Prime Injected');
            await page.evaluate((code) => {
                const script = document.createElement('script');
                script.textContent = code;
                document.documentElement.appendChild(script);
            }, claimerCode);
        });

        const targetUrl = 'https://stake.com/?tab=offers&modal=redeemBonus';
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        
        state.setEngineActive(true);
        console.log('🛡️ [Engine] ONLINE');

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
        return null;
    }
}

module.exports = { launchApp, takeScreenshot };
