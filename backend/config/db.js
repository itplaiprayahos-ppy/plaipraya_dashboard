const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE_NAME,
    port: process.env.DB_PORT,
});

// ป้องกัน server ล่มเมื่อการเชื่อมต่อที่ว่างอยู่หลุด
pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err.message);
});

module.exports = pool;
