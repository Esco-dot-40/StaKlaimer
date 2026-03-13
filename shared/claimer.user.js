// ==UserScript==
// @name         Vanguard Prime | Stake Auto-Claimer
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  High-speed stealth claimer with Prime HUD & Handshake
// @author       Vanguard
// @match        https://stake.com/*
// @match        https://stake.bz/*
// @match        https://stake.jp/*
// @match        https://stake.us/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const WS_URL = window.PHANTOM_INTERNAL_SERVER || 'ws://staklaimer-production.up.railway.app?userId=vanguard_user&type=browser';
    const AUTO_SUBMIT = true;

    let socket;
    let promoInput = null;
    let claimButton = null;
    let hudElement = null;
    let wakeLock = null;

    // --- ANTI-THROTTLE ENGINE (STAY AWAKE) ---
    const keepAwake = () => {
        // High-Priority Audio Hack: Browsers won't throttle tabs playing audio
        const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
        audio.loop = true;
        
        const stayAwake = () => {
            audio.play().catch(() => {
                // Wait for user interaction if blocked
                window.addEventListener('click', () => audio.play(), { once: true });
            });
        };
        stayAwake();
        console.log('🛡️ [Phantom] Wake-Engine: Active (Silent Audio Bridge)');
    };

    // --- UI/UX ENGINE ---
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes v-pulse { 0% { box-shadow: 0 0 0 0 rgba(0, 231, 1, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(0, 231, 1, 0); } 100% { box-shadow: 0 0 0 0 rgba(0, 231, 1, 0); } }
            @keyframes v-slide { from { transform: translateX(100%) scale(0.9); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }
            .v-splash { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #00e701; color: black; padding: 12px 24px; border-radius: 12px; font-family: 'Outfit', sans-serif; font-weight: 800; z-index: 1000000; box-shadow: 0 10px 40px rgba(0, 231, 1, 0.4); font-size: 16px; display: flex; align-items: center; gap: 10px; animation: v-slide 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28); }
        `;
        document.head.appendChild(style);
    };

    const showSplash = (text) => {
        const splash = document.createElement('div');
        splash.className = 'v-splash';
        splash.innerHTML = `🛡️ <span>${text}</span>`;
        document.body.appendChild(splash);
        setTimeout(() => splash.style.opacity = '0', 2500);
        setTimeout(() => splash.remove(), 3000);
    };

    const createHUD = () => {
        if (hudElement) return;
        hudElement = document.createElement('div');
        hudElement.style = `position: fixed; bottom: 20px; right: 20px; background: rgba(10, 15, 25, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 10px 18px; color: white; z-index: 999999; font-family: sans-serif; box-shadow: 0 8px 32px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 12px; transition: all 0.3s; border-left: 4px solid #334155;`;
        hudElement.innerHTML = `
            <div id="v-dot" style="width: 10px; height: 10px; background: #64748b; border-radius: 50%;"></div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 9px; font-weight: 800; color: #475569; letter-spacing: 1px;">VANGUARD PRIME</span>
                <span id="v-status" style="font-size: 12px; font-weight: 600; color: #94a3b8;">SEARCHING SERVER...</span>
            </div>
        `;
        document.body.appendChild(hudElement);
    };

    const updateHUD = (status, color, active = false) => {
        if (!hudElement) createHUD();
        const dot = document.getElementById('v-dot');
        const text = document.getElementById('v-status');
        const hud = hudElement;

        text.innerText = status.toUpperCase();
        text.style.color = color;
        dot.style.background = color;
        hud.style.borderLeftColor = color;
        
        if (active) {
            dot.style.animation = 'v-pulse 2s infinite';
            hud.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 15px ${color}22`;
        } else {
            dot.style.animation = 'none';
        }
    };

    // --- LOGIC ENGINE ---
    const findElements = () => {
        promoInput = document.querySelector('input[name="code"]') || 
                     document.querySelector('input[placeholder*="Code"]') ||
                     document.querySelector('input[placeholder*="Promo"]') ||
                     document.querySelector('input[type="text"]'); // Fallback
                     
        claimButton = document.querySelector('button[type="submit"]') || 
                      document.querySelector('button.variant-primary') ||
                      document.querySelector('button[data-testid="redeem-button"]') ||
                      document.evaluate("//button[contains(., 'Redeem')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (promoInput && claimButton) {
            if (socket && socket.readyState === WebSocket.OPEN) {
                updateHUD('Synced & Ready', '#00e701', true);
            }
        }
    };

    const connect = () => {
        keepAwake();
        injectStyles();
        createHUD();
        
        // Ensure WS_URL has the expected query parameters
        let finalUrl = WS_URL;
        if (!finalUrl.includes('?')) {
            finalUrl += '?userId=vanguard_local&type=browser';
        }
        
        socket = new WebSocket(finalUrl);

        socket.onopen = () => {
            showSplash("SYNCHRONIZED WITH VANGUARD CLOUD");
            updateHUD('Cloud Linked', '#0ea5e9', true);
            
            // Aggressive Keep-Alive to prevent background throttling
            setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'STATUS_UPDATE', status: 'AWAKE', timestamp: Date.now() }));
                }
            }, 15000);

            setInterval(findElements, 2000);

            // --- RESULT TRACKER ---
            let lastAttemptedCode = null;
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            const text = node.innerText || "";
                            if (text.includes("successfully") || text.includes("redeemed") || text.includes("claimed") || text.includes("invalid") || text.includes("wager")) {
                                if (lastAttemptedCode) {
                                    let status = "Unknown";
                                    if (text.includes("successfully")) status = "Success";
                                    else if (text.includes("already")) status = "Already Claimed";
                                    else if (text.includes("invalid")) status = "Invalid Code";
                                    else if (text.includes("wager") || text.includes("requirement")) status = "Wager Req Not Met";
                                    else status = text.substring(0, 30); // Capture snippet

                                    console.log(`📊 Claim Result for [${lastAttemptedCode}]: ${status}`);
                                    socket.send(JSON.stringify({ type: 'CLAIM_RESULT', code: lastAttemptedCode, status: status, timestamp: Date.now() }));
                                    lastAttemptedCode = null; // Clear to prevent double logging
                                }
                            }
                        }
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            window._vanguard_last_code = (c) => { lastAttemptedCode = c; };
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'CLAIM_CODE') {
                    const code = data.code;
                    console.log(`🎯 Code Received from Vanguard Cloud: [${code}]`);
                    
                    // Send receipt back to server
                    socket.send(JSON.stringify({ type: 'CLAIM_RECEIPT', code: code, timestamp: Date.now() }));
                    
                    handleClaim(code);
                }
            } catch (e) {
                console.error("Error parsing WebSocket message:", e);
            }
        };

        socket.onclose = () => {
            updateHUD('Lost Connection', '#ef4444');
            setTimeout(connect, 5000);
        };
    };

    const handleClaim = (code) => {
        if (!promoInput || !claimButton) findElements();
        if (!promoInput) {
            showSplash(`CODE DETECTED: ${code}`);
            return;
        }

        promoInput.value = code;
        promoInput.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof window._vanguard_last_code === 'function') window._vanguard_last_code(code);
        
        if (AUTO_SUBMIT) {
            claimButton.click();
            showSplash(`AUTO-CLAIMED: ${code}`);
            updateHUD(`Claimed ${code}`, '#00e701', true);
        }
    };

    connect();
})();
