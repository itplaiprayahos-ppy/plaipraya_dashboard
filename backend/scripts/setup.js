// ติดตั้งฐานข้อมูลทั้งหมดด้วยคำสั่งเดียว:  npm run setup
// - สร้างตาราง (db/schema.sql)
// - โหลดข้อมูลหน่วยบริการ chospital (ครั้งแรก)
// - ใส่ข้อมูลตัวชี้วัดเริ่มต้น + ย้ายข้อมูลจากตารางเดิม
// - สร้างบัญชี admin จาก ADMIN_* ใน .env
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const pool = require('../config/db');
const { seed } = require('../db/seed');
const { createAdminUser } = require('../config/init_admin_user');
const { migrate } = require('../db/migrate');

async function main() {
    const client = await pool.connect();
    try {
        console.log('1) สร้างตาราง...');
        await client.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));

        console.log('2) ตรวจสอบตาราง chospital...');
        const ch = await client.query(`SELECT to_regclass('public.chospital') AS t`);
        let empty = true;
        if (ch.rows[0].t) {
            const n = await client.query('SELECT COUNT(*)::int AS n FROM chospital');
            empty = n.rows[0].n === 0;
        }
        if (empty) {
            console.log('   กำลังโหลด chospital (อาจใช้เวลาสักครู่)...');
            await client.query(fs.readFileSync(path.join(__dirname, '..', 'config', 'chosptal.sql'), 'utf8'));
        } else {
            console.log('   มีข้อมูลแล้ว ข้าม');
        }

        console.log('3) ข้อมูลเริ่มต้น...');
        await client.query('BEGIN');
        const log = await seed(client);
        await client.query('COMMIT');
        log.forEach(l => console.log('   - ' + l));
        if (!log.length) console.log('   มีข้อมูลแล้ว ข้าม');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('❌ ติดตั้งไม่สำเร็จ:', err.message);
        process.exitCode = 1;
        return;
    } finally {
        client.release();
    }

    await migrate();
    console.log('4) บัญชีผู้ดูแลระบบ...');
    await createAdminUser();
    console.log('✅ เสร็จเรียบร้อย  เริ่มเซิร์ฟเวอร์ด้วย: npm start');
}

main().finally(() => pool.end());
