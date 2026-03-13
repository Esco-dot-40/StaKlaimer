// Shared state for tracking real-time metrics and connections
module.exports = {
    clients: new Map(), // userId -> ws
    startTime: Date.now()
};
