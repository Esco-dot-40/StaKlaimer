require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');

let activePage = null;

async function launchApp() {
    const isHeadless = process.env.HEADLESS !== 'false';
    console.log(`🌐 Launching Phantom Browser (Headless: ${isHeadless})...`);
    
    chromium.use(stealth);

    const userDataDir = path.join(process.cwd(), 'user_data');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir);

    try {
        const browser = await chromium.launchPersistentContext(userDataDir, {
            headless: isHeadless,
            viewport: { width: 1280, height: 720 },
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage'
            ]
        });

        const page = await browser.newPage();
        activePage = page;
        
        page.on('console', msg => {
            const text = msg.text();
            if (text.startsWith('%c%d')) return;
            console.log(`[Browser] ${text}`);
        });
        
        const claimerPath = path.join(__dirname, '../shared/claimer.user.js');
        const claimerCode = fs.readFileSync(claimerPath, 'utf8');
        
        const PORT = process.env.PORT || 3000;
        await page.addInitScript((port) => {
            window.PHANTOM_INTERNAL_SERVER = `ws://localhost:${port}`;
        }, PORT);

        page.on('domcontentloaded', async () => {
            console.log('💉 Injecting Phantom Logic into Stake...');
            await page.evaluate((code) => {
                const script = document.createElement('script');
                script.textContent = code;
                document.documentElement.appendChild(script);
            }, claimerCode);
        });

        const targetUrl = 'https://stake.com/?tab=offers&modal=redeemBonus';
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
        
        console.log('🛡️ Vanguard Phantom Active');
        console.log('🌐 Application running on real Stake.com');
        console.log('📡 Listening for incoming codes via WebSocket...');

    } catch (err) {
        console.error('❌ Browser Launch Error:', err);
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
