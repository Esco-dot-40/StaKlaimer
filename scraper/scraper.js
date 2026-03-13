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
    'AutoEnhancd'          // User's specific channel
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
    console.log("Session String (Save this to .env as TELEGRAM_SESSION to skip login next time):");
    console.log(client.session.save());

    client.addEventHandler(async (event) => {
        const message = event.message;
        if (!message || !message.text) return;

        const chat = await message.getChat();
        const channelName = chat.username || chat.title || 'Unknown';
        
        // Check if message is from a target channel
        const isTarget = TARGET_CHANNELS.some(target => 
            channelName.toLowerCase().includes(target.toLowerCase())
        );

        if (!isTarget) return;

        console.log(`[Message Received] From ${channelName}: ${message.text.substring(0, 50)}...`);

        // Refined Stake Code Regex (alphanumeric, hashes, usually 8+ chars or specific patterns)
        const matches = message.text.match(/\b[A-Za-z0-9_-]{7,40}\b/g);
        if (matches) {
            for (const code of matches) {
                if (isLikelyCode(code)) {
                    console.log(`🚀 Found potential Stake code: [${code}]`);
                    await sendToVanguard(code, channelName, message.id);
                }
            }
        }
    }, new NewMessage({}));
}

function isLikelyCode(str) {
    // Basic heuristics: Stake codes usually are uppercase, numbers, and specific lengths
    // Customize this to filter out noise
    const commonWords = ['STAKE', 'BONUS', 'CLAIM', 'LINK', 'HTTPS', 'RELOAD'];
    if (commonWords.includes(str.toUpperCase())) return false;
    return str.length >= 6; 
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
