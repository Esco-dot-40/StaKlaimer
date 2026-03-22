require('dotenv').config();
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const path = require('path');
const fs = require('fs');
const state = require('./state');
const axios = require('axios');

let activePage = null;
let socialPages = [];

// Helper to filter likely codes
function isLikelyCode(str) {
    const blacklist = ['PLATFORM', 'ALREADY', 'CLAIMED', 'DROPPING', 'MULTIPLE', 'STAKE', 'BONUS', 'WELCOME', 'SUPPORT', 'MESSAGE', 'CHANNEL', 'RELOAD', 'ADDRESS', 'NETWORK', 'DEPOSIT', 'WITHDRAW', 'BALANCE', 'ACCOUNT', 'OFFERS', 'REDEEM', 'SETTINGS', 'ACTIVE', 'VANGUARD', 'STEALTH', 'BROWSER', 'INJECT', 'CAPTCHA', 'ENGINE', 'ONLINE', 'MONITOR', 'CONNECTED', 'DISCONNECTED', 'SYCHRONIZED', 'POTENTIAL', 'FOUND', 'HTTP', 'HTTPS', 'REGISTER', 'VIDEOS', 'COMMENT', 'BETID', 'TIMEOUT', 'FAILED', 'ENABLE', 'AMOUNT', 'CORRECT', 'UPDATE', 'REQUEST', 'THREAD', 'REVIEWS', 'WINNER', 'PREVIEW'];
    const upperStr = str.toUpperCase();
    if (blacklist.some(word => upperStr.includes(word) && upperStr.length === word.length)) return false;
    if (str.length < 5) return false;
    if (str.startsWith('_')) return false;
    if (/^\d+$/.test(str)) return false;
    if (/^[a-z]+$/.test(str) && str.length < 10) return false;
    if (str.toLowerCase().startsWith('http')) return false;
    return true;
}

async function launchApp() {
    const isHeadless = process.env.HEADLESS === 'true'; // Default to visible (headed) for EXE mode
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT || !!process.env.RAILWAY_STATIC_URL || !!process.env.PORT;
    
    // Captcha Overrides
    const CAPTCHA_KEY = process.env.NOPECHA_KEY;
    const AUTO_SOLVE = process.env.CAPTCHA_AUTO_SOLVE !== 'false';
    
    console.log(`🚀 [VANGUARD ENGINE v3.2] Ignition Initiated`);
    console.log(`🌐 [Engine] Mode: ${isHeadless ? 'Headless' : 'Visible'}, Captcha Solve: ${CAPTCHA_KEY ? 'ENABLED' : 'DISABLED'}`);
    
    chromium.use(stealth);

    // Force system library path visibility
    process.env.LD_LIBRARY_PATH = `${process.env.LD_LIBRARY_PATH || ''}:/usr/lib/x86_64-linux-gnu:/lib/x86_64-linux-gnu`;

    try {
        console.log(`🚀 [Engine] Attempting Chromium launch...`);
        
        console.log(`🚀 [Engine] Connecting over CDP to Local Chrome (Port 9222)...`);
        
        const browser = await chromium.connectOverCDP('http://localhost:9222');
        const context = browser.contexts()[0];
        
        if (!context) {
             throw new Error("No active browser context found in Connected Chrome session.");
        }

        // Find an existing Stake tab, or grab the absolute first tab loaded
        let page = context.pages().find(p => p.url().includes('stake.com'));
        if (!page) {
             console.log("🧭 [Engine] No Stake.com tab found. Re-routing to primary tab...");
             page = context.pages()[0] || await context.newPage();
        }
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
                // Safety guard to avoid double injections
                if (window.__VANGUARD_INJECTED) return; 
                window.__VANGUARD_INJECTED = true;
                const script = document.createElement('script');
                script.textContent = code;
                document.documentElement.appendChild(script);
            }, claimerCode);
        });

        // Trigger immediate injection if the tab was ALREADY open before script connected
        if (page.url().includes('stake.com')) {
             console.log("💉 [Engine] Injecting instantly into active layout node...");
             await page.evaluate((code) => {
                 if (window.__VANGUARD_INJECTED) return;
                 window.__VANGUARD_INJECTED = true;
                 const script = document.createElement('script');
                 script.textContent = code;
                 document.documentElement.appendChild(script);
             }, claimerCode).catch(()=>{});
        }

        const targetUrl = 'https://stake.com/?tab=offers&modal=redeemBonus';
        console.log(`🧭 [Engine] WAITING: Please navigate to Stake.com manually in your opened browser window.`);
        console.log(`💡 [Engine] Tip: Solve the Captcha & Log In. Vanguard will automatically inject on load!`);
        
        // Remove automatic navigation to avoid trigger caps
        // await page.goto(targetUrl, { waitUntil: 'commit', timeout: 120000 });
        
        // --- TURNSTILE BYPASS ---
        console.log('🤖 [Engine] Captcha Sentry Armed');
        
        // This is a 'wait-and-solve' loop that looks for challenges
        setInterval(async () => {
            try {
                const hasCaptcha = await page.evaluate(() => {
                    return document.querySelector('iframe[src*="captcha"]') !== null || 
                           document.querySelector('div.cf-turnstile') !== null;
                });

                if (hasCaptcha) {
                    console.log('🧩 [Engine] Challenge Detected. Attempting Bypass...');
                    
                    // Find Cloudflare Turnstile frame
                    const cfFrame = page.frames().find(f => f.url().includes('challenges.cloudflare.com'));
                    if (cfFrame) {
                        try {
                            // Try finding the checkbox element inside the frame
                            const checkbox = await cfFrame.$('input[type="checkbox"], #checkbox, .cb-checkbox');
                            if (checkbox) {
                                console.log('✅ [Engine] Found Turnstile Checkbox. Clicking...');
                                await checkbox.click({ force: true });
                            } else {
                                // Fallback: click coordinates
                                const frameElement = await cfFrame.frameElement();
                                const box = await frameElement.boundingBox();
                                if (box) {
                                    console.log('✅ [Engine] Clicking coordinates for Turnstile frame...');
                                    // Click closer to the left side where the checkbox usually is.
                                    await page.mouse.click(box.x + 30, box.y + box.height / 2);
                                }
                            }
                        } catch (err) {
                            console.log(`⚠️ [Engine] Frame click failed: ${err.message}`);
                        }
                    } else {
                        // General mouse movement as fallback
                        await page.mouse.move(Math.random() * 100, Math.random() * 100);
                    }
                }
            } catch (e) {}
        }, 5000);

        state.setEngineActive(true);
        console.log('🛡️ [Engine] ONLINE & MONITORING');

        // Return focus to the main stake tab
        await page.bringToFront();

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
