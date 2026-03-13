// ==UserScript==
// @name         Stake Stealth Claimer (Phantom)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  High-speed stealth claimer for Stake bonuses
// @author       Antigravity
// @match        https://stake.com/*
// @match        https://stake.bz/*
// @match        https://stake.jp/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // CONFIGURATION
    const WS_URL = window.PHANTOM_INTERNAL_SERVER || 'ws://localhost:3000?userId=vanguard_local';
    const AUTO_SUBMIT = true;
    const LATENCY_LOGGING = true;

    let socket;
    let promoInput = null;
    let claimButton = null;

    // Cache DOM elements for 0.5ms reaction
    // Note: Stake's DOM may vary, these selectors should be verified
    const findElements = () => {
        // Look for common promo input patterns
        promoInput = document.querySelector('input[name="code"]') || 
                     document.querySelector('input[placeholder*="Bonus Code"]') ||
                     document.querySelector('input[placeholder*="Promo"]') ||
                     document.querySelector('input[placeholder*="Code"]');
        
        claimButton = document.querySelector('button[type="submit"]') || 
                      document.evaluate("//button[contains(., 'Redeem')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue ||
                      document.querySelector('button.variant-primary');

        if (promoInput && claimButton) {
            console.log('%c[Phantom] Elements Cached - Ready for drop', 'color: #00ff00; font-weight: bold;');
        }
    };

    // Run every 2 seconds to ensure elements are ready if user navigates
    setInterval(findElements, 2000);

    const claim = (code) => {
        const startTime = performance.now();
        
        if (!promoInput || !claimButton) {
            findElements();
            if (!promoInput) {
                console.error('[Phantom] Input not found. Are you on the right page?');
                return;
            }
        }

        // Stealth Injection: Simulate React/Vue input event to trigger internal state
        promoInput.value = code;
        promoInput.dispatchEvent(new Event('input', { bubbles: true }));
        promoInput.dispatchEvent(new Event('change', { bubbles: true }));

        if (AUTO_SUBMIT) {
            // Instant click
            claimButton.click();
            
            const endTime = performance.now();
            if (LATENCY_LOGGING) {
                console.log(`%c[Phantom] CLAIMED: ${code} in ${(endTime - startTime).toFixed(4)}ms`, 'background: #222; color: #bada55');
            }
        }
    };

    const connect = () => {
        console.log('[Phantom] Connecting to Vanguard...');
        socket = new WebSocket(WS_URL);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'CLAIM_CODE') {
                claim(data.code);
            }
        };

        socket.onclose = () => {
            console.log('[Phantom] Disconnected. Retrying in 5s...');
            setTimeout(connect, 5000);
        };

        socket.onerror = (err) => {
            console.error('[Phantom] WebSocket Error:', err);
        };
    };

    connect();
    findElements();

})();
