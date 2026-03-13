const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const input = require("input");
const axios = require("axios");
require('dotenv').config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || ""); 

// Configuration: Add the channel usernames you want to monitor here
const TARGET_CHANNELS = [
    'Stake',              // Official Stake
    'StakeDrops',        // Example drop channel
    'StakeBonus',        // Example bonus channel
];

const PROMO_REGEX = /\b[A-Za-z0-9_-]{5,20}\b/g; // Adjust based on Stake code patterns

async function startScraper() {
    console.log("🛠 Starting Scraper Engine...");
    
    if (!apiId || !apiHash) {
        console.log("⚠️ TEST MODE: No Telegram API credentials found. Simulating data drops...");
        setInterval(() => {
            const mockCode = "TEST-" + Math.random().toString(36).substring(2, 7).toUpperCase();
            console.log(`[Mock Scraper] Found code: ${mockCode}`);
            sendToVanguard(mockCode, "Mock-Channel");
        }, 10000); // 10 seconds for testing
        return;
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
        const sender = await message.getSender();
        const chat = await message.getChat();
        
        // Check if message is from a target channel
        const channelName = chat.username || chat.title;
        console.log(`[Message Received] From ${channelName}: ${message.text.substring(0, 50)}...`);

        // Simple Regex extraction
        const matches = message.text.match(PROMO_REGEX);
        if (matches) {
            for (const code of matches) {
                // Filter out common words if necessary
                if (isLikelyCode(code)) {
                    console.log(`🚀 Found potential Stake code: [${code}]`);
                    await sendToVanguard(code, channelName);
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

async function sendToVanguard(code, source) {
    try {
        await axios.post('http://localhost:3000/api/new-code', {
            code: code,
            source: `Telegram / ${source}`,
            type: 'auto-scrape'
        });
        console.log(`✅ Code successfully forwarded to Vanguard.`);
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
