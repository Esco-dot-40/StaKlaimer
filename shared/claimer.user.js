// ==UserScript==
// @name         Stake Stealth Claimer (Vanguard HUD)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  High-speed stealth claimer with real-time HUD
// @author       Vanguard
// @match        https://stake.com/*
// @match        https://stake.bz/*
// @match        https://stake.jp/*
// @match        https://stake.us/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // CONFIGURATION
    const WS_URL = window.PHANTOM_INTERNAL_SERVER || 'ws://localhost:3000?userId=vanguard_local';
    const AUTO_SUBMIT = true;

    let socket;
    let promoInput = null;
    let claimButton = null;
    let hudElement = null;

    // --- UI ENGINE ---
    const createHUD = () => {
        if (hudElement) return;
        
        hudElement = document.createElement('div');
        hudElement.id = 'vanguard-hud';
        hudElement.style = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(0, 231, 1, 0.3);
            border-radius: 16px;
            padding: 12px 20px;
            color: white;
            z-index: 999999;
            font-family: sans-serif;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0, 231, 1, 0.1);
            display: flex;
            align-items: center;
            gap: 15px;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            cursor: pointer;
            user-select: none;
        `;

        hudElement.innerHTML = `
            <div id="v-dot" style="width: 10px; height: 10px; background: #e11d48; border-radius: 50%; box-shadow: 0 0 10px rgba(225, 29, 72, 0.5);"></div>
            <div style="display: flex; flex-direction: column;">
                <span style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 1px;">VANGUARD HUB</span>
                <span id="v-status" style="font-size: 13px; font-weight: 600; color: #f8fafc;">Connecting...</span>
            </div>
        `;

        document.body.appendChild(hudElement);
        
        hudElement.onclick = () => {
            hudElement.style.transform = 'scale(0.95)';
            setTimeout(() => hudElement.style.transform = 'scale(1)', 100);
        };
    };

    const updateHUD = (status, color, pulse = false) => {
        if (!hudElement) createHUD();
        const dot = document.getElementById('v-dot');
        const text = document.getElementById('v-status');
        
        text.innerText = status;
        dot.style.background = color;
        dot.style.boxShadow = `0 0 15px ${color}`;
        
        if (pulse) {
            dot.animate([
                { transform: 'scale(1)', opacity: 1 },
                { transform: 'scale(2)', opacity: 0 }
            ], { duration: 1000, iterations: 1 });
        }
    };

    // --- LOGIC ENGINE ---
    const findElements = () => {
        promoInput = document.querySelector('input[name="code"]') || 
                     document.querySelector('input[placeholder*="Bonus Code"]') ||
                     document.querySelector('input[placeholder*="Code"]');
        
        claimButton = document.querySelector('button[type="submit"]') || 
                      document.evaluate("//button[contains(., 'Redeem')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue ||
                      document.querySelector('button.variant-primary');

        if (promoInput && claimButton) {
            if (socket && socket.readyState === WebSocket.OPEN) {
                updateHUD('ACTIVE & READY', '#00e701');
            }
        }
    };

    setInterval(findElements, 2000);

    const claim = (code) => {
        if (!promoInput || !claimButton) {
            findElements();
            if (!promoInput) return updateHUD('ERROR: NAVIGATE TO REDEEM', '#e11d48');
        }

        promoInput.value = code;
        promoInput.dispatchEvent(new Event('input', { bubbles: true }));
        promoInput.dispatchEvent(new Event('change', { bubbles: true }));

        if (AUTO_SUBMIT) {
            claimButton.click();
            updateHUD(`CLAIMED: ${code}`, '#00e701', true);
            setTimeout(() => updateHUD('ACTIVE & READY', '#00e701'), 4000);
        }
    };

    const connect = () => {
        createHUD();
        socket = new WebSocket(WS_URL);

        socket.onopen = () => {
            updateHUD('LINKED TO CLOUD', '#0ea5e9');
            setTimeout(findElements, 500);
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'CLAIM_CODE') {
                claim(data.code);
            }
        };

        socket.onclose = () => {
            updateHUD('RECONNECTING...', '#f59e0b');
            setTimeout(connect, 5000);
        };
    };

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
    } else {
        connect();
    }

})();
