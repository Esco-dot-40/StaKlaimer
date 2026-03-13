// Using native fetch (Node 18+)


const BLOCKED_COUNTRIES = ['NL']; // Netherlands
const ADMIN_IPS = process.env.ADMIN_IPS ? process.env.ADMIN_IPS.split(',') : [];

const geoMiddleware = async (req, res, next) => {
    // Get client IP
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().replace(/^.*:/, '');

    // Bypass for Admin
    if (ADMIN_IPS.includes(ip)) {
        return next();
    }

    // Skip geoblocking for health check
    if (req.path === '/health') return next();

    try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,isp,proxy,hosting`);
        const geo = await geoRes.json();

        // Attach geo info to request for logging
        req.geo = geo;

        if (geo.status === 'success') {
            if (BLOCKED_COUNTRIES.includes(geo.countryCode)) {
                console.warn(`🚫 Blocked connection attempt from ${geo.country} (${ip})`);
                return res.status(403).send('<h1>403 Forbidden</h1><p>Access from your region is restricted.</p>');
            }
        }
    } catch (e) {
        console.error('GeoMiddleware Error:', e.message);
        // Fallback: allow if geo service is down, or block? Usually allow but log.
    }

    next();
};

module.exports = geoMiddleware;
