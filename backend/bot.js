const { Telegraf, Markup } = require('telegraf');
const db = require('./db');

const token = process.env.TELEGRAM_TOKEN;
if (!token) {
    console.warn('⚠️ WARNING: TELEGRAM_TOKEN is missing. Bot will not start.');
}

const bot = token ? new Telegraf(token) : null;

if (bot) {
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

    bot.launch().catch(err => {
        console.error('❌ Failed to launch Telegram Bot:', err.message);
    });
    console.log('🤖 Telegram Bot (Telegraf) is running...');
}

module.exports = bot;
