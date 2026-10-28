// อัปเดตโครงสร้างฐานข้อมูลอัตโนมัติตอนเปิด server (ปลอดภัย รันซ้ำได้)
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { getSettings } = require('../services/settings');

async function migrate() {
    const client = await pool.connect();
    try {
        const k = await client.query(`SELECT to_regclass('public.kpis') AS t`);
        if (!k.rows[0].t) {
            console.warn('⚠️  ยังไม่มีตารางในฐานข้อมูล กรุณารัน: npm run setup');
            return;
        }
        await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
        // สิทธิ์เหลือ 2 แบบ: superadmin -> admin, ค่าว่าง -> user
        await client.query(`UPDATE users SET role = 'admin' WHERE role = 'superadmin'`);
        await client.query(`UPDATE users SET role = 'user' WHERE role IS NULL OR role NOT IN ('user', 'admin')`);
        const cur = (await getSettings()).b_year;
        await client.query('UPDATE kpis SET b_year = $1 WHERE b_year IS NULL', [cur]);
        await client.query(
            `INSERT INTO fiscal_years (year)
             SELECT DISTINCT b_year FROM kpis WHERE b_year IS NOT NULL
             UNION SELECT $1::varchar
             ON CONFLICT DO NOTHING`,
            [cur]
        );
    } finally {
        client.release();
    }
}

module.exports = { migrate };
