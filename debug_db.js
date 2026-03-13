const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

const claimTable = `
    CREATE TABLE IF NOT EXISTS claims (
        id SERIAL PRIMARY KEY,
        code TEXT,
        source TEXT,
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

try {
    const sql = claimTable.replace('SERIAL', 'INTEGER AUTOINCREMENT').replace('TIMESTAMP', 'DATETIME');
    console.log('SQL:', sql);
    db.prepare(sql).run();
} catch (e) {
    console.error('Error:', e.message);
}
