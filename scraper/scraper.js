const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const input = require("input");
const axios = require("axios");
require('dotenv').config();

const apiId = parseInt(process.env.TELEGRAM_API_ID || process.env.APP_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH || process.env.APP_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || ""); 

// Configuration: Add the channel usernames you want to monitor here
const TARGET_CHANNELS = [
    'Stake',              // Official Stake
    'StakeDrops',        // Official Drops
    'StakeBonus',        // Bonus Channel
    'CrashDaddyCourtyard', // Request from User
    'StakeAutomation',     // Request from User
    'StakecomDailyDrops',  // Request from User
    'StakeCasino',         // Request from User
    'StakeUSA',            // Stake.US
    'StakeLimits',         // Common drop source
    'BonusCodeNetwork',    // Common drop source
    'StakeCodez',          // Common drop source
    'CasinoCodes',         // Common drop source
    'AutoEnhancd',         // User's specific channel
    'CrashCodes',          // Seen in screenshot
    'Play Smarter',        // Seen in screenshot
    'VIP Notices',         // Seen in screenshot
    'Daily Drops'          // Generic match for "Stake.com - Daily Drops"
];

const PROMO_REGEX = /\b[A-Za-z0-9_-]{5,20}\b/g; // Adjust based on Stake code patterns

async function startScraper() {
    console.log("🛠 Starting Scraper Engine...");
    
    if (!apiId || !apiHash || process.env.SKIP_TELEGRAM === 'true') {
        console.log("⚠️ TEST MODE: Simulating Telegram data drops...");
        setInterval(() => {
            const mockCode = "TEST-" + Math.random().toString(36).substring(2, 7).toUpperCase();
            console.log(`[Mock Scraper] Found code: ${mockCode}`);
            sendToVanguard(mockCode, "Mock-Channel", Math.floor(Math.random() * 10000));
        }, 15000); // 15 seconds for testing
        return;
    }

    if (!process.env.TELEGRAM_SESSION) {
        if (process.stdout.isTTY) {
            console.log("ℹ️ No TELEGRAM_SESSION found. Starting interactive login to generate one...");
        } else {
            console.warn("⚠️ CRITICAL: TELEGRAM_SESSION is missing in .env!");
            console.warn("⚠️ Scraper cannot start in non-interactive mode (Cloud/CI) without a session string.");
            console.warn("⚠️ Run locally in a terminal once to generate a session string.");
            return;
        }
    }

    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input.text("Please enter your number: "),
        password: async () => await input.text("Please enter your password: "),
        phoneCode: async () => await input.text("Please enter the code you received: "),
        onError: (err) => console.log(err),
    });

    console.log("✅ Scraper Connected to Telegram!");
    
    // Log joined channels for verification
    try {
        const dialogs = await client.getDialogs({});
        const joinedUsernames = dialogs.map(d => (d.entity.username || '').toLowerCase());
        console.log(`📊 Joined Dialogs: ${dialogs.length}`);
        
        const monitored = TARGET_CHANNELS.filter(t => joinedUsernames.includes(t.toLowerCase()));
        console.log(`📡 Monitoring ${monitored.length}/${TARGET_CHANNELS.length} Target Channels:`, monitored);
        
        if (monitored.length === 0) {
            console.warn("⚠️ WARNING: Not joined to ANY target channels! The scraper won't see anything.");
        }
    } catch (e) {
        console.log("⚠️ Could not list dialogs.");
    }
    
    console.log("Session String (Save this to .env as TELEGRAM_SESSION to skip login next time):");
    console.log(client.session.save());

    client.addEventHandler(async (event) => {
        try {
            const message = event.message;
            if (!message || !message.text) return;

            const chat = await message.getChat().catch(() => null);
            if (!chat) return;

            const channelName = (chat.username || chat.title || 'Unknown').toString();
            
            // Check if message is from a target channel
            const isTarget = TARGET_CHANNELS.some(target => 
                channelName.toLowerCase().includes(target.toLowerCase())
            );

            if (!isTarget) return;

            console.log(`[Message Received] From ${channelName}`);
            // console.log(`[Text] ${message.text.substring(0, 100)}...`);
            
            // Refined Stake Code Regex (alphanumeric, usually 7+ chars)
            const matches = message.text.match(/\b[A-Za-z0-9_-]{7,40}\b/g);
            if (matches) {
                for (const code of matches) {
                    if (isLikelyCode(code)) {
                        console.log(`🎯 Potential Code Found: [${code}]`);
                        await sendToVanguard(code, channelName, message.id);
                    }
                }
            }
        } catch (handlerErr) {
            console.error('❌ Scraper Event Error:', handlerErr.message);
        }
    }, new NewMessage({}));
}

function isLikelyCode(str) {
    // 1. Blacklist of common words and Stake UI terms that aren't codes
    const blacklist = [
        'PLATFORM', 'ALREADY', 'CLAIMED', 'DROPPING', 'MULTIPLE', 'STAKE', 
        'BONUS', 'WELCOME', 'SUPPORT', 'MESSAGE', 'CHANNEL', 'RELOAD',
        'ADDRESS', 'NETWORK', 'DEPOSIT', 'WITHDRAW', 'BALANCE', 'ACCOUNT',
        'OFFERS', 'REDEEM', 'SETTINGS', 'ACTIVE', 'VANGUARD', 'STEALTH',
        'BROWSER', 'INJECT', 'CAPTCHA', 'ENGINE', 'ONLINE', 'MONITOR',
        'CONNECTED', 'DISCONNECTED', 'SYCHRONIZED', 'POTENTIAL', 'FOUND'
    ];
    
    const upperStr = str.toUpperCase();
    if (blacklist.some(word => upperStr.includes(word) && upperStr.length === word.length)) return false;

    // 2. Length check (Stake codes are almost always 8+ chars, but we keep 7 for safety)
    if (str.length < 7) return false;

    // 3. Reject purely numeric strings (likely amounts or timestamps)
    if (/^\d+$/.test(str)) return false;

    // 4. Heuristic: Reject common sentence words and Usernames
    // Stake codes are typically ALL CAPS or have specific prefixes.
    const hasNumbers = /\d/.test(str);
    const isAllCaps = str === upperStr;
    const isMixedCase = str !== upperStr && str !== str.toLowerCase();
    
    // NEW: Reject lowercase alphanumeric (common for usernames like 'bhinds239')
    const isLowerAlphanumeric = /^[a-z0-9]+$/.test(str) && !isAllCaps;
    if (isLowerAlphanumeric && str.length < 12) return false;

    // If it's a normal English word pattern (Mixed case without numbers), reject
    if (isMixedCase && !hasNumbers && str.length < 15) return false;

    // If it's all letters and lowercase, reject
    if (/^[a-z]+$/.test(str)) return false;

    // Stake codes are usually:
    // - ALL CAPS + Numbers (STAKE123)
    // - Specific prefixes (STAKE-, etc)
    return isAllCaps || (hasNumbers && str.length > 8) || str.length > 15;
}

async function sendToVanguard(code, source, msgId) {
    const PORT = process.env.PORT || 3000;
    try {
        // 1. Forward to Backend for Browser Injection
        await axios.post(`http://localhost:${PORT}/api/new-code`, {
            code: code,
            source: `Telegram / ${source}`,
            type: 'auto-scrape'
        });
        console.log(`✅ Code successfully forwarded to Vanguard.`);

        // 2. Notify User via Bot (Optional but recommended)
        const botToken = process.env.TELEGRAM_TOKEN;
        const myId = process.env.MY_TELEGRAM_ID; // Add this to .env if you want personal alerts
        if (botToken && myId) {
            const botUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
            await axios.post(botUrl, {
                chat_id: myId,
                text: `🚀 *NEW CODE FOUND!*\n\nSource: \`${source}\`\nCode: \`${code}\`\n\n[View Message](https://t.me/${source}/${msgId})`,
                parse_mode: 'Markdown'
            }).catch(() => {}); // Ignore bot notification errors
        }

    } catch (err) {
        console.error(`❌ Failed to forward code: ${err.message}`);
    }
}

// Start if run directly
if (require.main === module) {
    startScraper();
} else {
    module.exports = startScraper;
}
