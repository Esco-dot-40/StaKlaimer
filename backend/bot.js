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

    // Bot starts immediately for the user
    bot.start(async (ctx) => {
        ctx.replyWithMarkdown(
            "👋 *Stake Stealth Claimer (Solo Mode)*\n\n" +
            "Your ID: `" + ctx.from.id + "`\n\n" +
            "Everything is pre-activated for you. Our scrapers are monitoring channels.\n\n" +
            "💡 *Tip:* Ensure your browser window is open and showing the Stake bonus tab."
        );
    });

    bot.command('id', (ctx) => {
        ctx.reply(`Your Telegram ID: ${ctx.from.id}`);
    });

    bot.action('activate', async (ctx) => {
        db.activateUser(ctx.from.id);
        await ctx.answerCbQuery("Account Activated!");
        await ctx.editMessageText(
            "🚀 *Account Activated!*\n\n" +
            "You are now linked to the Vanguard network. Our scrapers are monitoring Telegram, Kick, and X 24/7.\n\n" +
            "💡 *Tip:* Stay on the Stake page for maximum claim speed.",
            { parse_mode: 'Markdown' }
        );
    });

    bot.command('status', async (ctx) => {
        const recent = await db.getRecentClaims(10);
        let claimText = recent.map(c => `🔹 \`${c.code}\` (${c.source})`).join('\n') || "_No codes detected in the last 24h._";

        const isBrowserConnected = state.clients.size > 0;
        const statusEmoji = isBrowserConnected ? "🟢 ACTIVE" : "🔴 STANDBY";

        ctx.replyWithMarkdown(
            `🛰️ *VANGUARD HUB STATUS*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `🖥️ *Engine:* ${statusEmoji}\n` +
            `📡 *Active Nodes:* \`${state.clients.size}\` (Solo Instance)\n\n` +
            `🕒 *Recent Network Activity:*\n${claimText}\n\n` +
            `💡 _Use /screen to see the live browser feed._`
        );
    });

    bot.command('connect', (ctx) => {
        const isBrowserConnected = state.clients.size > 0;
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        
        if (isBrowserConnected) {
            ctx.replyWithMarkdown(
                "✅ *Vanguard: Linked & Synchronized*\n\n" +
                "The server's internal browser is currently at Stake.com and ready to claim. " +
                "You do *not* need to keep any tabs open on your device."
            );
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
        const isBrowserConnected = state.clients.size > 0;
        if (isBrowserConnected) {
            ctx.replyWithMarkdown("✅ *Stake Status: Connected*\n\nYour browser is successfully linked to the Vanguard engine. Scrapers are active and monitoring!");
        } else {
            ctx.replyWithMarkdown("⚠️ *Stake Status: Not Found*\n\nI can't see your browser. Please ensure:\n1. Your browser is open at Stake.com\n2. You are on the 'Redeem Bonus' tab.");
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
        // Register commands with Telegram UI automatically
        bot.telegram.setMyCommands([
            { command: 'status', description: 'Monitor live connection & recent claims' },
            { command: 'screen', description: 'View real-time Stake browser feed' },
            { command: 'logs', description: 'View recent server console output' },
            { command: 'boot', description: 'Manually start/restart the browser engine' },
            { command: 'connect', description: 'Check engine sync status' },
            { command: 'test', description: 'Simulate a code drop to verify system' },
            { command: 'ping', description: 'Check bot heartbeat' }
        ]);

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
