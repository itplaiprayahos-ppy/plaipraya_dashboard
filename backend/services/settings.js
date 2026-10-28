const pool = require('../config/db');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

// ค่าเริ่มต้น (ใช้ค่าจาก .env ถ้ามี) — แก้ได้ในหน้า "ตั้งค่าระบบ"
const SETTING_DEFS = {
    site_name:       { label: 'ชื่อระบบ', default: 'KPI Dashboard' },
    b_year:          { label: 'ปีงบประมาณเริ่มต้น (แสดงเมื่อเปิดเว็บ)', default: process.env.B_YEAR || '2569' },
    province_code:   { label: 'รหัสจังหวัด (ใช้ดึงข้อมูล HDC)', default: process.env.CHW_CODE || '81' },
    zone_code:       { label: 'รหัสเขตสุขภาพ', default: process.env.ZONE_CODE || '11' },
    amp_code:        { label: 'รหัสอำเภอ', default: process.env.AMP_CODE || '8106' },
    default_hoscode: { label: 'รหัสหน่วยบริการหลัก (ค่าเริ่มต้นของสรุปผล)', default: '99862' },
    hdc_api_url:     { label: 'URL API ของ HDC', default: process.env.HDC_API_URL || 'https://opendata.moph.go.th/api/report_data' },
};

async function getSettings() {
    const out = {};
    for (const [k, def] of Object.entries(SETTING_DEFS)) out[k] = def.default;
    const r = await pool.query('SELECT key, value FROM app_settings');
    for (const row of r.rows) if (row.key in SETTING_DEFS && row.value !== null && row.value !== '') out[row.key] = row.value;
    return out;
}

async function saveSettings(values, client = pool) {
    for (const [k, v] of Object.entries(values || {})) {
        if (!(k in SETTING_DEFS)) continue;
        await client.query(
            `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [k, v === null || v === undefined ? '' : String(v).trim()]
        );
    }
}

module.exports = { SETTING_DEFS, getSettings, saveSettings };
