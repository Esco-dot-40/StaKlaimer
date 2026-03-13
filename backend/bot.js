require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('./db');

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
        const recent = await db.getRecentClaims(5);
        let claimText = recent.map(c => `🔹 \`${c.code}\` (${c.source})`).join('\n') || "No recent claims.";

        ctx.replyWithMarkdown(
            `🛡️ *Vanguard Status: 🟢 Running*\n\n` +
            `🕒 *Recent Network Claims:*\n${claimText}`
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
        ctx.replyWithMarkdown("🔗 *Connecting to Vanguard...*\n\nStatus: `Online`\nSignal: `Strong`\n\nYour browser instance is being monitored.");
    });

    bot.command('ping', (ctx) => ctx.reply('🏓 Pong! Bot is alive and well.'));
}

const initBot = () => {
    if (bot) {
        bot.launch().catch(err => {
            console.error('❌ Failed to launch Telegram Bot:', err.message);
        });
        console.log('🤖 Telegram Bot (Telegraf) is running...');
    }
    return bot;
};

module.exports = { initBot };
