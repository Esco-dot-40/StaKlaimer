require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const db = require('./db');
const payments = require('./payments');
const state = require('./state');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

function init() {
// In-memory store for connected clients is now in state.js object
const clients = state.clients;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

    // Serving the userscript with dynamic BASE_URL for easy installation
    app.get('/claimer.user.js', (req, res) => {
        const tgId = req.query.tgId || 'anonymous';
        const filePath = path.join(__dirname, '../shared/claimer.user.js');
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Inject the real server URL into the script automatically
        let baseUrl = process.env.BASE_URL || `localhost:${PORT}`;
        
        // Clean up baseUrl (remove http/https if present to normalize)
        baseUrl = baseUrl.replace(/^https?:\/\//, '');
        
        // In production (Railway), always use wss://. Locally use ws://
        const protocol = (process.env.BASE_URL && !process.env.BASE_URL.includes('localhost')) ? 'wss' : 'ws';
        const wsUrl = `${protocol}://${baseUrl}`;
        
        content = content.replace(
            "const WS_URL = window.PHANTOM_INTERNAL_SERVER || 'ws://staklaimer-production.up.railway.app?userId=vanguard_user&type=browser';",
            `const WS_URL = window.PHANTOM_INTERNAL_SERVER || '${wsUrl}?userId=${tgId}&type=browser';`
        );
    
    res.type('application/javascript').send(content);
});

// --- WebSocket Logic ---
wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const userId = urlParams.get('userId') || 'anonymous';
    const type = urlParams.get('type') || 'browser';
    
    console.log(`New ${type} connected: ${userId}`);
    
    if (type === 'browser') {
        clients.set(userId, ws);
    } else {
        // Monitor clients (Dashboard)
        ws.isMonitor = true;
    }

    ws.on('close', () => {
        clearInterval(heartbeat);
        if (type === 'browser') {
            clients.delete(userId);
        }
        console.log(`${type} disconnected: ${userId}`);
    });

    // Send a heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
            } catch (e) {
                clearInterval(heartbeat);
            }
        } else if (ws.readyState !== WebSocket.CONNECTING) {
            clearInterval(heartbeat);
        }
    }, 30000);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'STATUS_UPDATE') {
                if (data.status !== 'AWAKE') {
                    console.log(`Status from ${userId}: ${data.status}`);
                }
            } else if (data.type === 'CLAIM_RECEIPT') {
                console.log(`✅ RECEIPT: Browser [${userId}] confirmed receipt of code: [${data.code}]`);
            } else if (data.type === 'CLAIM_RESULT') {
                console.log(`📊 RESULT from [${userId}] for [${data.code}]: ${data.status}`);
                await db.updateClaimStatus(data.code, data.status);
                
                if (userId && userId !== 'vanguard_local' && userId !== 'vanguard_user' && userId !== 'anonymous' && TELEGRAM_TOKEN) {
                    try {
                        let msg = ``;
                        if (data.status === 'Success') {
                            msg = `✅ *WINNER!* Successfully claimed \`${data.code}\` to your Stake Account!`;
                        } else {
                            msg = `❌ *Code Attempted:* \`${data.code}\`\n*Result:* ${data.status}`;
                        }
                        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                            chat_id: userId,
                            text: msg,
                            parse_mode: 'Markdown'
                        });
                    } catch (err) {
                        console.error(`Failed to notify user ${userId}:`, err.message);
                    }
                }
            }
        } catch (e) {
            console.error('Error parsing WS message', e);
        }
    });


});

// --- HELPER WRAPPERS (CLAUDE OPTIMIZERS) ---
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const tokenCooldowns = new Map();

function isTokenCoolingDown(token) {
    const until = tokenCooldowns.get(token);
    return until && Date.now() < until;
}

function setTokenCooldown(token, ms = 15000) {
    tokenCooldowns.set(token, Date.now() + ms);
}

async function graphqlWithRetry(token, code, maxRetries = 3) {
    let attempt = 0;
    let delay = 500;

    while (attempt < maxRetries) {
        if (isTokenCoolingDown(token)) {
            return { status: 403, data: { errors: [{ message: "CF/Slowdown Cooldown Active" }] } };
        }

        try {
            const response = await axios.post(
                'https://stake.com/_api/graphql',
                {
                    query: `mutation RedeemBonus($code: String!) {
                        redeemBonus(code: $code) { code amount currency value }
                    }`,
                    variables: { code: code }
                },
                {
                    headers: {
                        'x-access-token': token,
                        'content-type': 'application/json',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0'
                    },
                    validateStatus: () => true,
                    timeout: 8000
                }
            );

            if (response.status === 429 || response.status === 403) {
                if (response.status === 403) setTokenCooldown(token, 15000);
                const retryAfter = parseInt(response.headers['retry-after'] || '0') * 1000;
                const wait = retryAfter || delay;
                console.warn(`[GraphQL] ${response.status} on attempt ${attempt + 1}. Waiting ${wait}ms`);
                await sleep(wait);
                delay *= 2;
                attempt++;
                continue;
            }

            return response;
        } catch (err) {
            if (attempt === maxRetries - 1) throw err;
            await sleep(delay);
            delay *= 2;
            attempt++;
        }
    }
    throw new Error(`Max retries reached for code: ${code}`);
}

async function withConcurrencyLimit(tasks, limit = 3) {
    const results = [];
    const executing = new Set();
    for (const task of tasks) {
        const p = Promise.resolve().then(task).finally(() => executing.delete(p));
        results.push(p);
        executing.add(p);
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    return Promise.allSettled(results);
}

// --- Ingestion Endpoint ---
app.post('/api/new-code', async (req, res) => {
    const { code, source, type } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });

    console.log(`🚀 New code received: [${code}] from ${source}`);
    await db.logClaim(code, source);

    try {
        const cloudUsers = await db.getAllActiveUsers();
        if (cloudUsers && cloudUsers.length > 0) {
            console.log(`☁️ [Cloud Engine] High-speed API injection for ${cloudUsers.length} linked tokens...`);

            const tasks = cloudUsers
                .filter(u => u.session_token)
                .map(user => async () => {
                    const token = user.session_token;
                    try {
                        const response = await graphqlWithRetry(token, code);
                        
                        let status = "Unknown";
                        let msg = '';
                        
                        if (response.data && response.data.data && response.data.data.redeemBonus) {
                            status = "Success";
                            msg = `✅ *CLOUD WINNER!* Successfully triggered API claim for \`${code}\`!\nAmount: ${response.data.data.redeemBonus.value || response.data.data.redeemBonus.amount}`;
                        } else if (response.data && response.data.errors) {
                            const errStr = JSON.stringify(response.data.errors);
                            if (errStr.includes("already")) status = "Already Claimed";
                            else if (errStr.includes("not found") || errStr.includes("invalid")) status = "Invalid Code";
                            else if (errStr.includes("wager")) status = "Wager Req Not Met";
                            else if (errStr.includes("rate limit")) status = "Rate Limited";
                            else status = "Failed: " + (response.data.errors[0]?.message || 'Unknown').substring(0, 30);
                            msg = `☁️ *Cloud Engine:* \`${code}\`\n*Result:* ${status}`;
                        } else if (response.status === 403) {
                            status = "CF Turnstile Blocked";
                            msg = `🚫 *Cloud Engine:* \`${code}\` blocked by Cloudflare (403). Awaiting fallback.`;
                        } else {
                            status = "API Error";
                            msg = `⚠️ *Cloud Error:* \`${code}\` returned ${response.status}`;
                        }

                        await db.updateClaimStatus(code, status);
                        
                        if (TELEGRAM_TOKEN && user.telegram_id) {
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                                chat_id: user.telegram_id,
                                text: msg,
                                parse_mode: 'Markdown'
                            }).catch(()=>{});
                        }
                        console.log(`📊 [Cloud Engine] ${user.telegram_id} for [${code}]: ${status}`);

                    } catch (err) {
                        console.log(`📊 [Cloud Engine] Request failed for ${user.telegram_id}: ${err.message}`);
                    }
                });

            await withConcurrencyLimit(tasks, 3);
        }
    } catch (dbErr) {
        console.error("Cloud DB fetching error", dbErr);
    }

    // Broadcast to all active browser instances
    const payload = JSON.stringify({
        type: 'CLAIM_CODE',
        code: code,
        timestamp: Date.now()
    });

    let activeCount = 0;
    const notifiedIds = [];
    clients.forEach((ws, userId) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
            activeCount++;
            notifiedIds.push(userId);
        }
    });

    console.log(`Broadcasting to ${activeCount} browser clients (${notifiedIds.join(', ')}) via WS`);

    // Broadcast to all Monitor clients (for the real-time Dashboard)
    const dashboardPayload = JSON.stringify({
        type: 'LOG_EVENT',
        data: { code, source, type: type || 'auto-scrape', timestamp: Date.now() }
    });

    wss.clients.forEach((client) => {
        if (client.isMonitor && client.readyState === WebSocket.OPEN) {
            client.send(dashboardPayload);
        }
    });

    res.json({ success: true, clientsNotified: activeCount });
});

// --- Dashboard APIs ---
app.get('/api/history', async (req, res) => {
    try {
        const recent = await db.getRecentClaims(15);
        res.json(recent);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// --- Payment & Registration Endpoints ---
app.post('/api/payments/create', async (req, res) => {
    const { tgId, stakeUsername, packageId } = req.body;
    try {
        const invoice = await payments.createInvoice(tgId, stakeUsername, packageId);
        res.json({ success: true, invoice_url: invoice.invoice_url });
    } catch (e) {
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});

app.post('/api/payments/ipn-callback', async (req, res) => {
    const payment = req.body;
    // In a real app, verify HMAC signature here using IPN_SECRET
    if (payment.payment_status === 'finished') {
        const tgId = payment.order_id.split('_')[1];
        await db.activateUser(tgId);
        console.log(`💰 Payment finished for User ${tgId}. Account activated.`);
    }
    res.send('OK');
});

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Vanguard Backend listening on PORT: ${PORT}`);
    });
}

// Allow running directly or via require
if (require.main === module) {
    init();
} else {
    module.exports = init;
}
