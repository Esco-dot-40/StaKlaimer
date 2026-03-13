const axios = require('axios');
require('dotenv').config({ path: '../.env' });

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

const createInvoice = async (tgId, stakeUsername, packageId = 'basic') => {
    try {
        const response = await axios.post('https://api.nowpayments.io/v1/invoice', {
            price_amount: 10, // USDT
            price_currency: 'usdt',
            pay_currency: 'usdttrc20', // Defaulting to TRON network for low fees
            order_id: `CLAIM_${tgId}_${Date.now()}`,
            order_description: `Stake Auto Claim - ${stakeUsername}`,
            ipn_callback_url: process.env.BASE_URL + '/api/payments/ipn-callback',
            success_url: process.env.BASE_URL + '/success',
            cancel_url: process.env.BASE_URL + '/cancel'
        }, {
            headers: {
                'x-api-key': NOWPAYMENTS_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('NOWPayments Error:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = { createInvoice };
