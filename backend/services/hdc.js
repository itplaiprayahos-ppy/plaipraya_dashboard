// ดึงข้อมูลจาก HDC (opendata.moph.go.th) ตามชื่อตาราง แล้วเก็บแบบ JSONB
const axios = require('axios');
const pool = require('../config/db');
const { getSettings } = require('./settings');
const { isIdent, HttpError } = require('./util');

const snippet = (v) => {
    const t = typeof v === 'string' ? v : JSON.stringify(v);
    return (t || '').replace(/\s+/g, ' ').slice(0, 200);
};

async function fetchHdc(tableName, year, settings) {
    let response;
    try {
        response = await axios.post(settings.hdc_api_url, {
            tableName,
            year: String(year),
            province: String(settings.province_code),
            type: 'json',
        }, { timeout: 180000 });
    } catch (err) {
        // บอกสาเหตุให้ชัด: HTTP status + ข้อความที่ HDC ตอบกลับ หรือรหัส error ของเครือข่าย
        if (err.response) {
            throw new HttpError(502, `HDC ตอบกลับ HTTP ${err.response.status}: ${snippet(err.response.data)}`);
        }
        throw new HttpError(502, `เชื่อมต่อ ${settings.hdc_api_url} ไม่ได้ (${err.code || err.message})`);
    }
    let data = response.data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { /* ไม่ใช่ JSON */ }
    }
    if (data && !Array.isArray(data) && Array.isArray(data.data)) data = data.data;
    if (!Array.isArray(data)) {
        throw new HttpError(502, `HDC ไม่ได้ส่งรายการข้อมูลกลับมา (tableName: ${tableName}, ปี ${year}): ${snippet(data)}`);
    }
    return data;
}

async function syncTable(tableName, { year, user } = {}) {
    if (!isIdent(tableName)) throw new HttpError(400, 'ชื่อตารางไม่ถูกต้อง');
    const settings = await getSettings();
    const y = String(year || settings.b_year);
    let rows;
    try {
        rows = await fetchHdc(tableName, y, settings);
    } catch (err) {
        await pool.query(
            `INSERT INTO hdc_sync_log (table_name, b_year, row_count, status, error, synced_by) VALUES ($1,$2,0,'error',$3,$4)`,
            [tableName, y, err.message, user || null]
        );
        throw err;
    }

    // ลบของเดิม + ใส่ของใหม่ ใน transaction เดียว (ถ้าพังกลางทาง ข้อมูลเดิมยังอยู่)
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM hdc_raw WHERE table_name = $1 AND b_year = $2', [tableName, y]);
        await client.query(
            `INSERT INTO hdc_raw (table_name, b_year, hospcode, data)
             SELECT $1, $2, e ->> 'hospcode', e FROM jsonb_array_elements($3::jsonb) AS e`,
            [tableName, y, JSON.stringify(rows)]
        );
        await client.query(
            `INSERT INTO hdc_sync_log (table_name, b_year, row_count, status, synced_by) VALUES ($1,$2,$3,'success',$4)`,
            [tableName, y, rows.length, user || null]
        );
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        const message = `บันทึกลงฐานข้อมูลไม่สำเร็จ: ${err.message}`;
        await pool.query(
            `INSERT INTO hdc_sync_log (table_name, b_year, row_count, status, error, synced_by) VALUES ($1,$2,0,'error',$3,$4)`,
            [tableName, y, message, user || null]
        ).catch(() => {});
        throw new HttpError(500, message);
    } finally {
        client.release();
    }
    return { table_name: tableName, b_year: y, count: rows.length };
}

// รายชื่อฟิลด์ของตาราง (ใช้ช่วยตั้งค่าในหน้า admin)
async function listFields(tableName, { live = false } = {}) {
    if (!isIdent(tableName)) throw new HttpError(400, 'ชื่อตารางไม่ถูกต้อง');
    let sample = null;
    if (!live) {
        const r = await pool.query('SELECT data FROM hdc_raw WHERE table_name = $1 ORDER BY id DESC LIMIT 1', [tableName]);
        sample = r.rows[0] ? r.rows[0].data : null;
    }
    let source = 'local';
    if (!sample) {
        const settings = await getSettings();
        const rows = await fetchHdc(tableName, settings.b_year, settings);
        sample = rows[0] || null;
        source = 'hdc';
    }
    if (!sample) return { source, fields: [] };
    return {
        source,
        fields: Object.entries(sample).map(([name, value]) => ({ name, sample: value })),
    };
}

module.exports = { syncTable, listFields };
