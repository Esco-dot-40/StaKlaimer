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
        connectionRetries: 10,
        retryDelay: 3000,
    });

    const connectWithRetry = async (retryCount = 0) => {
        try {
            // Initial randomized delay in production to avoid collisions during rolling updates
            if (process.env.NODE_ENV === 'production' && retryCount === 0) {
                const delay = Math.floor(Math.random() * 5000) + 1000;
                console.log(`⏳ [Scraper] Initialization delay (${delay}ms)...`);
                await new Promise(r => setTimeout(r, delay));
            }

            await client.start({
                phoneNumber: async () => await input.text("Please enter your number: "),
                password: async () => await input.text("Please enter your password: "),
                phoneCode: async () => await input.text("Please enter the code you received: "),
                onError: (err) => {
                    if (err.message?.includes('AUTH_KEY_DUPLICATED')) {
                        console.warn("⚠️ AUTH_KEY_DUPLICATED: Another instance is trying to connect. Retrying...");
                    } else {
                        console.error('❌ Scraper start error:', err.message);
                    }
                },
            });
        } catch (err) {
            if (err.message?.includes('AUTH_KEY_DUPLICATED') && retryCount < 5) {
                console.warn(`⏳ [Scraper] Connection conflict (Attempt ${retryCount + 1}). Retrying in 5s...`);
                await new Promise(r => setTimeout(r, 5000));
                return connectWithRetry(retryCount + 1);
            }
            throw err;
        }
    };

    await connectWithRetry();
    console.log("✅ Scraper Connected to Telegram!");
    
    // Log joined channels for verification
    try {
        const dialogs = await client.getDialogs({});
        const joinedNames = dialogs.map(d => {
            const username = (d.entity?.username || '').toLowerCase();
            const title = (d.entity?.title || d.name || '').toLowerCase();
            return `${username} | ${title}`;
        });
        console.log(`📊 Joined Dialogs: ${dialogs.length}`);
        
        const monitored = TARGET_CHANNELS.filter(target => 
            joinedNames.some(name => name.includes(target.toLowerCase()))
        );
        console.log(`📡 Monitoring ${monitored.length}/${TARGET_CHANNELS.length} Target Channels:`, monitored);
        
        if (monitored.length === 0) {
            console.warn("⚠️ WARNING: Not joined to ANY target channels based on Username/Title!");
            console.warn("⚠️ If these are private channels, ensure your scraping account is actually a member.");
        }
    } catch (e) {
        console.log("⚠️ Could not list dialogs.", e.message);
    }
    
    console.log("Session String (Save this to .env as TELEGRAM_SESSION to skip login next time):");
    console.log(client.session.save());

    client.addEventHandler(async (event) => {
        try {
            const eventMsg = event.message;
            const text = eventMsg.message || eventMsg.text;
            if (!eventMsg || !text) return;

            const chat = await eventMsg.getChat().catch(() => null);
            if (!chat) return;

            const channelName = (chat.username || chat.title || 'Unknown').toString();
            
            // Check if message is from a target channel
            const isTarget = TARGET_CHANNELS.some(target => 
                channelName.toLowerCase().includes(target.toLowerCase())
            );

            // Temporarily log all incoming channels to help debug missing codes
            // console.log(`[GramJS Debug] Received chat activity from: ${channelName}`);

            // Refined Stake Code Regex (alphanumeric, 5+ chars up to 40, without strict word boundaries to avoid hyphen bugs)
            const matches = text.match(/[A-Za-z0-9_-]{5,40}/g);
            
            if (!isTarget) {
                if (matches && matches.some(c => isLikelyCode(c))) {
                    console.log(`⚠️ [Debugger] Ignored potential code in UNTRACKED channel: ${channelName} | Maybe add this to TARGET_CHANNELS?`);
                }
                return;
            }

            console.log(`[Message Received] From Tracking Array Match: ${channelName}`);
            // console.log(`[Text] ${text.substring(0, 100)}...`);
            
            if (matches) {
                for (const code of matches) {
                    if (isLikelyCode(code)) {
                        console.log(`🎯 Potential Code Found: [${code}]`);
                        await sendToVanguard(code, channelName, eventMsg.id);
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

    // 2. Length check (Stake codes can sometimes be as small as 5 or 6 characters)
    if (str.length < 5) return false;

    // Reject bot commands or usernames starting with underscores
    if (str.startsWith('_')) return false;

    // 3. Reject purely numeric strings (likely amounts or timestamps)
    if (/^\d+$/.test(str)) return false;

    // 4. If it's pure lowercase letters (no numbers) and looks like a basic word (short), reject it.
    // However, if it's longer than 10 characters it might be a phrase code like "bonusdrop".
    if (/^[a-z]+$/.test(str) && str.length < 10) return false;

    // Reject obvious English words that are title case or lower case (simplistic check)
    // If it has numbers, uppercase, or hyphens/underscores, it's very likely a code.
    return true;
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
