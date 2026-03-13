require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

let activePage = null;

async function launchApp() {
    const isHeadless = process.env.HEADLESS !== 'false';
    console.log(`🌐 [Engine] Ignition Sequence (Headless: ${isHeadless})...`);
    
    chromium.use(stealth);

    // Force Library Paths for Railway
    process.env.LD_LIBRARY_PATH = `${process.env.LD_LIBRARY_PATH || ''}:/usr/lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu`;

    try {
        const browser = await chromium.launch({
            headless: isHeadless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--single-process'
            ]
        });

        const page = await browser.newPage();
        activePage = page;
        
        const claimerPath = path.join(__dirname, '../shared/claimer.user.js');
        const claimerCode = fs.readFileSync(claimerPath, 'utf8');
        
        const PORT = process.env.PORT || 8080;
        await page.addInitScript((port) => {
            window.PHANTOM_INTERNAL_SERVER = `ws://localhost:${port}`;
        }, PORT);

        page.on('domcontentloaded', async () => {
            console.log('💉 [Engine] Injecting stealth core...');
            await page.evaluate((code) => {
                const script = document.createElement('script');
                script.textContent = code;
                document.documentElement.appendChild(script);
            }, claimerCode);
        });

        const targetUrl = 'https://stake.com/?tab=offers&modal=redeemBonus';
        await page.goto(targetUrl, { waitUntil: 'load', timeout: 60000 });
        
        console.log('🛡️ [Engine] VANGUARD ONLINE');

    } catch (err) {
        console.error('❌ [Engine] CRITICAL FAILURE:', err.message);
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
