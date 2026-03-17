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

(function () {
    'use strict';

    if (window.self !== window.top) return; // Prevent loading inside iframes

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
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Outfit:wght@300;600;800&display=swap');
            
            .v-dashboard { 
                position: fixed; top: 20px; right: 20px; width: 320px;
                background: linear-gradient(165deg, rgba(8, 12, 20, 0.98), rgba(0, 5, 10, 0.99));
                backdrop-filter: blur(25px); border: 1px solid rgba(0, 231, 1, 0.15);
                border-radius: 20px; padding: 0; color: #e2e8f0; z-index: 999999;
                font-family: 'Outfit', sans-serif; box-shadow: 0 20px 80px rgba(0, 0, 0, 0.6);
                transition: transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                overflow: hidden; border-top: 2px solid #00e701;
            }
            .v-header { 
                padding: 12px 18px; background: rgba(255, 255, 255, 0.02);
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                display: flex; align-items: center; justify-content: space-between;
                cursor: pointer; user-select: none;
            }
            .v-logo { font-family: 'Orbitron', sans-serif; font-size: 13px; color: #00e701; letter-spacing: 2px; font-weight: 700; }
            .v-toggle-btn { font-size: 14px; color: #64748b; transition: transform 0.3s; }
            .v-dashboard.collapsed .v-content { display: none; }
            .v-dashboard.collapsed { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
            .v-dashboard.collapsed .v-toggle-btn { transform: rotate(-180deg); }
            .v-content { padding: 15px 20px; display: flex; flex-direction: column; gap: 15px; }
            .v-metric { display: flex; align-items: center; gap: 12px; }
            .v-metric-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .v-metric-value { font-size: 13px; color: #f1f5f9; font-weight: 600; }
            .v-status-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
            
            .v-history { margin-top: 10px; max-height: 200px; overflow-y: auto; }
            .v-history-item { 
                padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.03);
                display: flex; align-items: flex-start; justify-content: space-between;
            }
            .v-history-code { font-family: monospace; font-size: 12px; color: #94a3b8; }
            .v-history-status { font-size: 10px; padding: 2px 8px; border-radius: 100px; font-weight: 700; }
            
            .v-splash { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #00e701; color: black; padding: 12px 24px; border-radius: 12px; font-family: 'Outfit', sans-serif; font-weight: 800; z-index: 1000000; box-shadow: 0 10px 40px rgba(0, 231, 1, 0.4); font-size: 16px; display: flex; align-items: center; gap: 10px; animation: v-slide 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28); }
            @keyframes v-slide { from { transform: translateX(100%) scale(0.9); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }
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

    const updateHistory = (code, status) => {
        const historyList = document.getElementById('v-history-list');
        if (!historyList) return;

        const item = document.createElement('div');
        item.className = 'v-history-item';
        const color = status.includes('Success') ? '#00e701' : '#f43f5e';
        const bg = status.includes('Success') ? 'rgba(0, 231, 1, 0.1)' : 'rgba(244, 63, 94, 0.1)';

        item.innerHTML = `
            <span class="v-history-code">${code}</span>
            <span class="v-history-status" style="color: ${color}; background: ${bg};">${status}</span>
        `;

        historyList.prepend(item);
        if (historyList.children.length > 5) historyList.lastChild.remove();
    };

    const createHUD = () => {
        if (hudElement) return;
        hudElement = document.createElement('div');
        hudElement.className = 'v-dashboard';
        hudElement.innerHTML = `
            <div class="v-header" id="v-header-toggle">
                <span class="v-logo">VANGUARD OS</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div id="v-main-dot" class="v-status-dot" style="color: #64748b; background: #64748b;"></div>
                    <span class="v-toggle-btn">▼</span>
                </div>
            </div>
            <div class="v-content">
                <div class="v-metric">
                    <div style="flex: 1;">
                        <div class="v-metric-label">Connection</div>
                        <div id="v-status" class="v-metric-value">SEARCHING...</div>
                    </div>
                    <div>
                        <div class="v-metric-label">Solo Engine</div>
                        <div class="v-metric-value" style="color: #00e701;">🟢 ACTIVE</div>
                    </div>
                </div>
                
                <div>
                    <div class="v-metric-label" style="margin-bottom: 8px;">Claim Session Logs</div>
                    <div id="v-history-list" class="v-history">
                        <div style="font-size: 11px; color: #475569; text-align: center; padding: 10px;">Waiting for packet ingestion...</div>
                    </div>
                </div>

                <div style="padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                    <div class="v-metric-label" style="margin-bottom: 4px;">Security Layer</div>
                    <div style="font-size: 11px; color: #94a3b8;">✅ Stealth Anti-Throttling Injected</div>
                </div>
            </div>
        `;
        document.body.appendChild(hudElement);

        document.getElementById('v-header-toggle').addEventListener('click', () => {
            hudElement.classList.toggle('collapsed');
        });
    };

    const updateHUD = (text, color, active = false) => {
        const statusText = document.getElementById('v-status');
        const mainDot = document.getElementById('v-main-dot');
        if (statusText) statusText.innerText = text.toUpperCase();
        if (mainDot) {
            mainDot.style.color = color;
            mainDot.style.background = color;
            if (active) mainDot.style.animation = 'v-pulse 2s infinite';
        }
    };

    // --- LOGIC ENGINE ---
    const findElements = () => {
        // 1. Gather all potential inputs
        const inputs = Array.from(document.querySelectorAll('input[name="code"], input[placeholder*="Code"], input[placeholder*="Promo"], input[data-testid*="code"]'));
        
        if (inputs.length === 0) {
            inputs.push(...Array.from(document.querySelectorAll('input[type="text"]')));
        }
        
        let targetInput = null;
        let targetButton = null;

        // 2. Filter out the "Welcome Offer" input and prioritize "Claim Bonus Drop"
        for (let i = inputs.length - 1; i >= 0; i--) {
            const input = inputs[i];
            
            // Look at surrounding container text
            const container = input.closest('form') || input.parentElement?.parentElement?.parentElement;
            const containerText = container ? container.innerText || "" : "";
            
            // If the container explicitly mentions Welcome Offer and NOT Bonus Drop, skip it.
            if (containerText.includes("Welcome Offer") && !containerText.includes("Claim Bonus Drop")) {
                continue; 
            }
            
            targetInput = input;
            
            // Try to find the button within the EXACT same container first
            if (container) {
                targetButton = container.querySelector('button[type="submit"]') || 
                               container.querySelector('button[data-testid="redeem-button"]');
            }
            break;
        }

        // 3. Fallbacks if strict filtering failed
        if (!targetInput && inputs.length > 0) {
            // Bonus drops are typically heavily nested or lower on the page than the Welcome Offer
            targetInput = inputs[inputs.length - 1]; 
        }

        if (targetInput && !targetButton) {
            targetButton = document.querySelector('button[type="submit"]') || 
                           document.querySelector('button.variant-primary') ||
                           document.querySelector('button[data-testid="redeem-button"]');
        }

        promoInput = targetInput;
        claimButton = targetButton;

        if (promoInput && claimButton) {
            if (socket && socket.readyState === WebSocket.OPEN) {
                updateHUD('Synced & Ready', '#00e701', true);
            }
            
            // Check for pending code after a forced redirect
            const pendingCode = sessionStorage.getItem('v-pending-code');
            if (pendingCode) {
                sessionStorage.removeItem('v-pending-code');
                console.log(`[Vanguard] Claiming pending code from session: ${pendingCode}`);
                
                const pollInput = setInterval(() => {
                    findElements();
                    if (promoInput && claimButton) {
                        clearInterval(pollInput);
                        handleClaim(pendingCode);
                    }
                }, 500);
                
                // Timeout polling after 15 seconds to avoid memory leaks
                setTimeout(() => clearInterval(pollInput), 15000);
            }
        }
    };

    const connect = () => {
        keepAwake();
        injectStyles();
        createHUD();

        updateHUD('Awaiting Login...', '#f59e0b');

        // --- LOGIN DETECTOR ---
        // Wait until the user is logged in to Stake before connecting to Vanguard Cloud
        const checkLogin = setInterval(() => {
            const isLoggedIn = document.querySelector('button[data-testid="sign-in"], .auth-modal') === null && 
                               (document.querySelector('div[class*="balance"]') !== null || document.cookie.includes('session='));
            
            if (isLoggedIn) {
                clearInterval(checkLogin);
                proceedToConnect();
            }
        }, 1500);

        const proceedToConnect = () => {
            // Ensure WS_URL has the expected query parameters
            let finalUrl = WS_URL;
            if (!finalUrl.includes('?')) {
                finalUrl += '?userId=vanguard_local&type=browser';
            }

            socket = new WebSocket(finalUrl);

            socket.onopen = () => {
                showSplash("SYNCHRONIZED WITH VANGUARD CLOUD");
                updateHUD('Synced & Ready', '#00e701', true);

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
                                if (text.includes("successfully") || text.includes("redeemed") || text.includes("claimed") || text.includes("invalid") || text.includes("wager") || text.includes("found") || text.includes("error")) {
                                    if (lastAttemptedCode) {
                                        let status = "Unknown";
                                        if (text.includes("successfully")) status = "Success";
                                        else if (text.includes("already")) status = "Already Claimed";
                                        else if (text.includes("invalid") || text.includes("found")) status = "Invalid Code";
                                        else if (text.includes("wager") || text.includes("requirement")) status = "Wager Req Not Met";
                                        else if (text.includes("error")) status = "Rate Limited / Error";
                                        else status = text.substring(0, 30); // Capture snippet

                                        console.log(`📊 Claim Result for [${lastAttemptedCode}]: ${status}`);
                                        socket.send(JSON.stringify({ type: 'CLAIM_RESULT', code: lastAttemptedCode, status: status, timestamp: Date.now() }));
                                        updateHistory(lastAttemptedCode, status);
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
                setTimeout(proceedToConnect, 5000);
            };
        };
    };

    const handleClaim = (code) => {
        if (!promoInput || !claimButton) findElements();

        if (!promoInput || !claimButton) {
            console.log(`[Vanguard] Redeem UI not visible. Redirecting for code: ${code}`);
            showSplash(`NAVIGATING TO REDEEM SETTINGS...`);
            sessionStorage.setItem('v-pending-code', code);
            window.location.href = 'https://stake.com/settings/offers?type=drop';
            return;
        }

        // Overhauled React 16+ Injection Hack
        promoInput.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(promoInput, code);

        // Stake requires both input and change events to validate
        promoInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        promoInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

        // Trigger blur to finalize validation state
        promoInput.blur();

        if (typeof window._vanguard_last_code === 'function') window._vanguard_last_code(code);

        if (AUTO_SUBMIT) {
            // Find the closest form's submit button or use the discovered generic button
            const form = promoInput.closest('form');
            const submitBtn = form ? form.querySelector('button[type="submit"]') : claimButton;

            setTimeout(() => {
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.click();
                } else if (claimButton) {
                    claimButton.click();
                }

                showSplash(`AUTO-CLAIMED: ${code}`);
                updateHUD(`Claimed ${code}`, '#00e701', true);
            }, 300); // 300ms sweet-spot to guarantee Stake's validation lifecycle completes
        }
    };

    connect();
})();
