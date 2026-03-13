const axios = require('axios');

async function triggerRealTest() {
    const code = "REAL-BONUS-" + Math.random().toString(36).substring(2, 7).toUpperCase();
    console.log(`📡 Simulating real data drop: [${code}]`);
    
    try {
        const response = await axios.post('http://localhost:3000/api/new-code', {
            code: code,
            source: 'Vanguard-Live-Test',
            type: 'manual'
        });
        
        console.log('✅ Vanguard received code.');
        console.log('👁️ Watch your Stake window! The code should be filled and submitted instantly.');
        console.log(`Response Info: Clients Notified: ${response.data.clientsNotified}`);
    } catch (error) {
        console.error('❌ Failed to reach Vanguard. Is StakeClaimer.exe / launcher.js running?');
    }
}

triggerRealTest();
