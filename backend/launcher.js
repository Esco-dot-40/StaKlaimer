require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

let activePage = null;

async function launchApp() {
    const isHeadless = process.env.HEADLESS !== 'false';
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    
    console.log(`🌐 [Engine] Ignition Sequence (Headless: ${isHeadless}, Railway: ${isRailway})...`);
    
    chromium.use(stealth);

    // Dynamic User Data Dir
    const userDataDir = isRailway ? '/tmp/user_data' : path.join(process.cwd(), 'user_data');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

    try {
        const browser = await chromium.launch({
            headless: isHeadless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-software-rasterizer',
                '--mute-audio',
                '--no-first-run',
                '--no-zygote',
                isRailway ? '--single-process' : ''
            ].filter(Boolean)
        });

        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        const page = await context.newPage();
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
        console.log(`📡 [Engine] Navigating to ${targetUrl}...`);
        
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        
        console.log('🛡️ [Engine] VANGUARD ONLINE');

    } catch (err) {
        console.error('❌ [Engine] CRITICAL FAILURE:', err.message);
        if (err.message.includes('executable')) {
            console.error('💡 TIP: Playwright browser might be missing. Ensure the build command ran correctly.');
        }
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
