const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;

async function getBotInfo() {
    if (!token) {
        console.error('❌ No TELEGRAM_TOKEN found in .env');
        return;
    }

    try {
        const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
        const bot = response.data.result;
        console.log('--- Bot Information ---');
        console.log(`Name: ${bot.first_name}`);
        console.log(`Username: @${bot.username}`);
        console.log(`Link: https://t.me/${bot.username}`);
        console.log('-----------------------');
    } catch (error) {
        console.error('❌ Failed to get bot info:', error.response?.data || error.message);
    }
}

getBotInfo();
