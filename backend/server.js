require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
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

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Serving the userscript with dynamic BASE_URL for easy installation
app.get('/claimer.user.js', (req, res) => {
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
        `const WS_URL = window.PHANTOM_INTERNAL_SERVER || '${wsUrl}?userId=vanguard_user&type=browser';`
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
        if (type === 'browser') {
            clients.delete(userId);
        }
        console.log(`${type} disconnected: ${userId}`);
    });

    // Send a heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
        }
    }, 30000);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'STATUS_UPDATE') {
                console.log(`Status from ${userId}: ${data.status}`);
            }
        } catch (e) {
            console.error('Error parsing WS message', e);
        }
    });

    ws.on('close', () => clearInterval(heartbeat));
});

// --- Ingestion Endpoint ---
// This is where your scrapers (Telegram, Kick, etc.) will POST new codes
app.post('/api/new-code', async (req, res) => {
    const { code, source, type } = req.body;
    
    if (!code) return res.status(400).json({ error: 'Code is required' });

    console.log(`🚀 New code received: [${code}] from ${source}`);

    // Log to DB
    await db.logClaim(code, source);

    // Broadcast to all active browser instances
    const payload = JSON.stringify({
        type: 'CLAIM_CODE',
        code: code,
        timestamp: Date.now()
    });

    let activeCount = 0;
    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
            activeCount++;
        }
    });

    console.log(`Broadcasting to ${activeCount} browser clients via WS`);

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
