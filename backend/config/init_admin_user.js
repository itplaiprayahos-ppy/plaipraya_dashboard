const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const pool = require('./db');
const bcrypt = require('bcrypt');
const { generateTimestampId } = require('../services/util');

async function createAdminUser() {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password) {
        console.log('   ข้าม: ไม่ได้ตั้ง ADMIN_USERNAME / ADMIN_PASSWORD ใน .env');
        return;
    }
    try {
        const email = process.env.ADMIN_EMAIL || null;
        const check = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (check.rows.length > 0) {
            console.log(`   มีผู้ใช้ '${username}' อยู่แล้ว ข้าม`);
            return;
        }
        const hashed = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO users (id, username, password, email, first_name, last_name, department, role)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'admin')`,
            [generateTimestampId(), username, hashed, email, process.env.ADMIN_FIRSTNAME || null,
             process.env.ADMIN_LASTNAME || null, process.env.ADMIN_DEPARTMENT || null]
        );
        console.log(`   สร้างผู้ดูแลระบบ '${username}' แล้ว`);
    } catch (error) {
        console.error('   สร้างผู้ดูแลระบบไม่สำเร็จ:', error.message);
    }
}

module.exports = { createAdminUser };

if (require.main === module) {
    createAdminUser().finally(() => pool.end());
}
