require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

// Capture logs for the /logs command
const logBuffer = [];
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    logBuffer.push(`[LOG] ${args.join(' ')}`);
    if (logBuffer.length > 50) logBuffer.shift();
    originalLog.apply(console, args);
};

console.error = (...args) => {
    logBuffer.push(`[ERR] ${args.join(' ')}`);
    if (logBuffer.length > 50) logBuffer.shift();
    originalError.apply(console, args);
};

const db = require('./db');
const state = require('./state');
const launcher = require('./launcher');

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
    console.warn('⚠️ WARNING: TELEGRAM_TOKEN is missing. Bot will not start.');
}

const bot = token ? new Telegraf(token) : null;

if (bot) {
    // Debug Logger
    bot.use(async (ctx, next) => {
        if (ctx.from) {
            console.log(`📩 [Bot] Incoming ${ctx.updateType} from ${ctx.from.username || ctx.from.id}: ${ctx.message?.text || '[No Text]'}`);
        }
        return next();
    });

    // Bot Onboarding Flow
    bot.start(async (ctx) => {
        ctx.replyWithMarkdown(
            "👋 *Welcome to Vanguard Stealth Claimer*\n\n" +
            "I automatically claim Stake bonus codes for you, milliseconds after they drop. This runs 100% in the cloud, so your PC can be off.\n\n" +
            "To get started, link your account by entering:\n" +
            "`/setuser YourStakeUsername`\n" +
            "Followed by:\n" +
            "`/settoken YourStakeSessionToken`"
        );
    });

    bot.command('setuser', async (ctx) => {
        const username = ctx.message.text.split(' ')[1];
        if (!username) return ctx.reply("❌ Please provide your Stake username. Example: `/setuser MyName123`", {parse_mode: 'Markdown'});
        
        try {
            await db.registerUser(ctx.from.id, ctx.from.username || 'unknown', username);
            await db.activateUser(ctx.from.id);
            
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            ctx.replyWithMarkdown(
                `✅ *Account Linked!*\n\nStake Username: \`${username}\`\n\n` +
                `*Next Step (Required for Wireless Cloud Claiming):*\n` +
                `You must provide your active Stake Session Token so Vanguard can claim on your behalf.\n\n` +
                `Type: \`/settoken YourSessionTokenHere\`\n\n` +
                `Not sure how to get your token? Type \`/guide\` for instructions.`
            );
        } catch (err) {
            console.error('Error linking user:', err);
            ctx.reply('❌ An error occurred while linking your account. Please try again.');
        }
    });

    bot.command('settoken', async (ctx) => {
        const tokenVal = ctx.message.text.split(' ')[1];
        if (!tokenVal) return ctx.reply("❌ Please provide your Stake session token.\nExample: `/settoken eyejabc1...`", {parse_mode: 'Markdown'});
        
        try {
            await db.updateSessionToken(ctx.from.id, tokenVal);
            ctx.replyWithMarkdown("✅ *Cloud Identity Synchronized!*\n\nYour session token is securely stored. Vanguard will now automatically claim all dropping codes directly to your account via the cloud API.\n\nYou do *NOT* need to keep a browser open anymore.");
        } catch (err) {
            console.error('Error linking token:', err);
            ctx.reply('❌ An error occurred while saving your token.');
        }
    });

    bot.command('guide', (ctx) => {
        ctx.replyWithMarkdown(
            "📖 *How to get your Session Token:*\n\n" +
            "1. Open Stake.com and Log In.\n" +
            "2. Press `F12` to open Developer Tools.\n" +
            "3. Go to `Application` (or `Storage` in Firefox).\n" +
            "4. Expand `Local Storage` and click on `https://stake.com`.\n" +
            "5. Find the Key named `session`.\n" +
            "6. Copy its Value (it's a long string).\n" +
            "7. Send it here using: `/settoken YOUR_LONG_STRING_HERE`"
        );
    });

    bot.command('status', async (ctx) => {
        const recent = await db.getRecentClaims(10);
        let claimText = recent.map(c => {
            const statusEmoji = c.status === 'Success' ? '✅' : (c.status === 'identified' ? '🔍' : '❌');
            return `${statusEmoji} \`${c.code}\`\n   └ _${c.status}_ (${c.source})`;
        }).join('\n') || "_No codes detected in the last 24h._";

        const engineActive = state.isEngineActive();
        const activeUserNodes = Array.from(state.clients.keys()).filter(id => id !== 'vanguard_user').length;
        const soloEngineStatus = engineActive ? "🟢 ACTIVE" : "🔴 STANDBY";

        ctx.replyWithMarkdown(
            `🛰️ *VANGUARD HUB STATUS*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🖥️ *Solo Engine:* ${soloEngineStatus}\n` +
            `📡 *Active User Nodes:* \`${activeUserNodes}\` Connected\n` +
            `🧩 *Captcha Solver:* ✅ FREE STEALTH\n\n` +
            `🕒 *Recent Network Activity:*\n${claimText}\n\n` +
            `💡 _Open Stake.com + Vanguard Script to link your own browser._`
        );
    });

    bot.command('connect', (ctx) => {
        const isBrowserConnected = state.clients.size > 0;
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        
        if (isBrowserConnected) {
            let replyText = "✅ *Vanguard: Linked & Synchronized*\n\n" +
                            "The server's internal browser is currently at Stake.com and ready to claim. " +
                            "You do *not* need to keep any tabs open on your device.";
            if (process.env.NOPECHA_KEY) {
                replyText += "\n\n🤖 *Captcha Solver:* Armed and ready to assist.";
            }
            ctx.replyWithMarkdown(replyText);
        } else {
            ctx.replyWithMarkdown(
                "⚠️ *Vanguard: Not Synchronized*\n\n" +
                "The server hasn't established a handshake with the browser yet.\n\n" +
                "1. If you want to use **Solo Mode**, wait for the server to finish initializing.\n" +
                "2. If you want to monitor **Manually**, install the script here:\n" +
                `👉 [Vanguard Claimer Script](${baseUrl}/claimer.user.js)`
            );
        }
    });

    bot.command('script', async (ctx) => {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        ctx.replyWithMarkdown(
            `📦 *Your Vanguard Script*\n\n` +
            `👉 [Download/Update Script](${baseUrl}/claimer.user.js?tgId=${ctx.from.id})\n\n` +
            `*Steps:*\n` +
            `1. Delete the old script from Tampermonkey.\n` +
            `2. Click the link above to install the new one.\n` +
            `3. Refresh Stake.com.`
        );
    });

    bot.command('test', async (ctx) => {
        const testCode = "TEST-CODE-" + Math.floor(Math.random() * 1000);
        ctx.replyWithMarkdown(`🧪 *Triggering Test Code:* \`${testCode}\`...\nCheck your Railway logs or browser console to see the injection!`);
        
        // Manual trigger via the same API the scraper uses
        const PORT = process.env.PORT || 3000;
        try {
            const axios = require('axios');
            await axios.post(`http://localhost:${PORT}/api/new-code`, {
                code: testCode,
                source: "Manual Test",
                type: "test"
            });
        } catch (e) {
            console.error('Test trigger failed:', e.message);
        }
    });

    bot.command('connect', (ctx) => {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const userNodes = Array.from(state.clients.keys()).filter(id => id !== 'vanguard_user');
        
        if (userNodes.length > 0) {
            ctx.replyWithMarkdown(
                "✅ *Vanguard: Linked & Ready*\n\n" +
                `I see \`${userNodes.length}\` browser(s) connected. You are ready to claim codes in real-time!`
            );
        } else {
            ctx.replyWithMarkdown(
                "⚠️ *Vanguard: No Active Browsers Found*\n\n" +
                "To get the claimer working right now:\n" +
                "1. Open **Stake.com** on your PC.\n" +
                "2. Go to **Settings > Offers > Redeem**.\n" +
                "3. Ensure the script is installed and shows 'Cloud Linked'.\n\n" +
                `👉 [Download/Update Script](${baseUrl}/claimer.user.js)`
            );
        }
    });

    bot.command('ping', (ctx) => ctx.reply('🏓 Pong! Bot is alive and well.'));

    bot.command('boot', async (ctx) => {
        ctx.reply("⚙️ *Starting Solo Engine...*\nStep 1: Triggering Chrome...");
        try {
            await launcher.launchApp();
            ctx.reply("✅ *Engine Initialized.* Check /screen in 10 seconds to see if you are logged in.");
        } catch (e) {
            // Truncate long error messages (Playwright logs can be huge)
            const cleanError = e.message.length > 500 ? e.message.substring(0, 500) + "..." : e.message;
            ctx.reply(`❌ *Ignition Failed:* ${cleanError}`);
        }
    });

    bot.command('logs', (ctx) => {
        const logs = logBuffer.slice(-50).join('\n');
        // If logs are still too long, send as a snippet
        const cleanLogs = logs.length > 4000 ? logs.substring(logs.length - 4000) : logs;
        ctx.replyWithMarkdown(`📋 *Full Server Logs (Last 50):*\n\`\`\`\n${cleanLogs || 'No logs captured yet.'}\n\`\`\``);
    });

    bot.command('screen', async (ctx) => {
        ctx.reply("📸 *Capturing Live View...* Please wait.");
        try {
            const screenshot = await launcher.takeScreenshot();
            if (screenshot) {
                await ctx.replyWithPhoto({ source: screenshot }, { caption: "🖼️ *Current Phantom View*\nThis is what the server-side browser sees on Stake." });
            } else {
                ctx.reply("🔴 *No Active Session Found.*\nThe browser isn't running on the server yet.");
            }
        } catch (e) {
            ctx.reply(`❌ *Failed to capture:* ${e.message}`);
        }
    });
}

const initBot = () => {
    if (bot) {
        try {
            bot.telegram.setMyCommands([
                { command: 'setuser', description: 'Link your Stake account (use: /setuser username)' },
                { command: 'settoken', description: 'Add your session token for wireless claiming' },
                { command: 'guide', description: 'Learn how to get your session token' },
                { command: 'status', description: 'Monitor live connection & recent claims' },
                { command: 'screen', description: 'View real-time Stake browser feed' },
                { command: 'script', description: 'Get your personalized userscript link' },
                { command: 'logs', description: 'View recent server console output' },
                { command: 'boot', description: 'Manually start/restart the browser engine' },
                { command: 'test', description: 'Simulate a code drop to verify system' },
                { command: 'ping', description: 'Check bot heartbeat' }
            ]);
        } catch (setCmdErr) {
            console.warn('⚠️ Warning: Failed to populate bot commands list on Telegram UI:', setCmdErr.message);
        }

        bot.launch().catch(err => {
            if (err.description && err.description.includes('Conflict')) {
                console.warn('⚠️ Bot Conflict: Another instance is already running. This is normal during rolling updates.');
            } else {
                console.error('❌ Failed to launch Telegram Bot:', err.message);
            }
        });
        console.log('🤖 Telegram Bot (Telegraf) is running...');
    }
    return bot;
};

module.exports = { initBot };
