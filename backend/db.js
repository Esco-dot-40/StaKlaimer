const { Pool } = require('pg');
const path = require('path');

let pool;
let sqliteDb;

const isPostgres = !!process.env.DATABASE_URL;

if (isPostgres) {
    console.log('🐘 Using Postgres (Railway/Production Mode)');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
} else {
    console.log('📁 Using SQLite (Local/Development Mode)');
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '../data.db');
    sqliteDb = new Database(dbPath);
}

// --- Initialization Logic ---
const init = async () => {
    const userTable = `
        CREATE TABLE IF NOT EXISTS users (
            telegram_id BIGINT PRIMARY KEY,
            username TEXT,
            stake_username TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    const claimTable = `
        CREATE TABLE IF NOT EXISTS claims (
            id SERIAL PRIMARY KEY,
            code TEXT,
            source TEXT,
            status TEXT DEFAULT 'identified',
            claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    if (isPostgres) {
        await pool.query(userTable);
        await pool.query(claimTable);
    } else {
        // Correctly handle SQLite autoincrement syntax
        const sqliteUserTable = userTable
            .replace('BIGINT PRIMARY KEY', 'INTEGER PRIMARY KEY')
            .replace('TIMESTAMP', 'DATETIME');
        
        const sqliteClaimTable = claimTable
            .replace('SERIAL PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT')
            .replace('TIMESTAMP', 'DATETIME');

        sqliteDb.prepare(sqliteUserTable).run();
        sqliteDb.prepare(sqliteClaimTable).run();
    }
};

module.exports = {
    init,
    registerUser: async (tgId, username, stakeUser) => {
        if (isPostgres) {
            return pool.query('INSERT INTO users (telegram_id, username, stake_username) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO UPDATE SET username = $2, stake_username = $3', [tgId, username, stakeUser]);
        }
        return sqliteDb.prepare('INSERT OR REPLACE INTO users (telegram_id, username, stake_username) VALUES (?, ?, ?)').run(tgId, username, stakeUser);
    },
    getUser: async (tgId) => {
        if (isPostgres) {
            const res = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [tgId]);
            return res.rows[0];
        }
        return sqliteDb.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tgId);
    },
    activateUser: async (tgId) => {
        if (isPostgres) {
            return pool.query("UPDATE users SET status = 'activated' WHERE telegram_id = $1", [tgId]);
        }
        return sqliteDb.prepare("UPDATE users SET status = 'activated' WHERE telegram_id = ?").run(tgId);
    },
    logClaim: async (code, source, status = 'identified') => {
        if (isPostgres) {
            return pool.query('INSERT INTO claims (code, source, status) VALUES ($1, $2, $3)', [code, source, status]);
        }
        return sqliteDb.prepare('INSERT INTO claims (code, source, status) VALUES (?, ?, ?)').run(code, source, status);
    },
    updateClaimStatus: async (code, status) => {
        if (isPostgres) {
            return pool.query('UPDATE claims SET status = $1 WHERE code = $2', [status, code]);
        }
        return sqliteDb.prepare('UPDATE claims SET status = ? WHERE code = ?').run(status, code);
    },
    getRecentClaims: async (limit = 10) => {
        if (isPostgres) {
            const res = await pool.query('SELECT * FROM claims ORDER BY claimed_at DESC LIMIT $1', [limit]);
            return res.rows;
        }
        return sqliteDb.prepare('SELECT * FROM claims ORDER BY claimed_at DESC LIMIT ?').all(limit);
    }
};
