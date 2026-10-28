// ปีงบประมาณ: แต่ละปีมีชุดตัวชี้วัดของตัวเอง
const express = require('express');
const router = express.Router();
const { audit } = require('../services/audit');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../services/util');
const { getSettings } = require('../services/settings');

const YEAR_RE = /^\d{4}$/;

router.get('/years', asyncHandler(async (req, res) => {
    const settings = await getSettings();
    const r = await pool.query(
        `SELECT y.year, y.note, y.created_at,
                (SELECT COUNT(*)::int FROM kpis k WHERE k.b_year = y.year AND NOT k.is_header) AS kpi_count
         FROM fiscal_years y ORDER BY y.year DESC`
    );
    res.json({ default_year: settings.b_year, years: r.rows });
}));

// body: { year, note?, copy_from? }  copy_from = คัดลอกตัวชี้วัด (+แหล่งข้อมูล HDC) จากปีนั้น
router.post('/admin/years', requireAdmin, asyncHandler(async (req, res) => {
    const { year, note, copy_from } = req.body || {};
    if (!YEAR_RE.test(String(year || ''))) return res.status(400).json({ message: 'ปีงบประมาณต้องเป็นตัวเลข 4 หลัก เช่น 2570' });
    if (copy_from && !YEAR_RE.test(String(copy_from))) return res.status(400).json({ message: 'ปีที่จะคัดลอกไม่ถูกต้อง' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const ins = await client.query(
            'INSERT INTO fiscal_years (year, note) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [String(year), note || null]
        );
        if (!ins.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `มีปีงบประมาณ ${year} อยู่แล้ว` });
        }
        let copied = 0;
        if (copy_from) {
            const src = await client.query('SELECT id FROM kpis WHERE b_year = $1 ORDER BY group_id, sort_order, id', [String(copy_from)]);
            for (const { id } of src.rows) {
                const k = await client.query(
                    `INSERT INTO kpis (group_id, sort_order, display_index, name, is_header, criterion, criterion_op, multiplier,
                                       unit_label, link, summary_scope, summary_hoscode, allow_manual, active, legacy_key, b_year)
                     SELECT group_id, sort_order, display_index, name, is_header, criterion, criterion_op, multiplier,
                            unit_label, link, summary_scope, summary_hoscode, allow_manual, active, legacy_key, $2
                     FROM kpis WHERE id = $1 RETURNING id`,
                    [id, String(year)]
                );
                await client.query(
                    `INSERT INTO kpi_sources (kpi_id, table_name, target_fields, result_fields)
                     SELECT $2, table_name, target_fields, result_fields FROM kpi_sources WHERE kpi_id = $1 ORDER BY id`,
                    [id, k.rows[0].id]
                );
                copied++;
            }
        }
        await client.query('COMMIT');
        audit(req, 'year.create', `สร้างปีงบประมาณ ${year}${copy_from ? ` (คัดลอก ${copied} ตัวชี้วัดจากปี ${copy_from})` : ' (ว่าง)'}`);
        res.json({ success: true, year: String(year), copied });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

router.put('/admin/years/:year', requireAdmin, asyncHandler(async (req, res) => {
    const r = await pool.query('UPDATE fiscal_years SET note = $1 WHERE year = $2', [(req.body && req.body.note) || null, req.params.year]);
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบปีงบประมาณ' });
    res.json({ success: true });
}));

// ลบปีงบ: ลบตัวชี้วัดและค่าที่กรอกเองของปีนั้น (ข้อมูลดิบ HDC ยังเก็บไว้)
router.delete('/admin/years/:year', requireAdmin, asyncHandler(async (req, res) => {
    const settings = await getSettings();
    if (req.params.year === settings.b_year) {
        return res.status(400).json({ message: 'ลบปีที่ตั้งเป็นปีเริ่มต้นไม่ได้ กรุณาเปลี่ยนปีเริ่มต้นในหน้าตั้งค่าก่อน' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const del = await client.query('DELETE FROM kpis WHERE b_year = $1', [req.params.year]);
        await client.query('DELETE FROM kpi_manual_values WHERE b_year = $1', [req.params.year]);
        const r = await client.query('DELETE FROM fiscal_years WHERE year = $1', [req.params.year]);
        if (!r.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'ไม่พบปีงบประมาณ' }); }
        await client.query('COMMIT');
        audit(req, 'year.delete', `ลบปีงบประมาณ ${req.params.year} (ตัวชี้วัด ${del.rowCount} รายการ)`, { level: 'warn' });
        res.json({ success: true, deleted_kpis: del.rowCount });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

module.exports = router;
