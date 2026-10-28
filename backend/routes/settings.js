const express = require('express');
const router = express.Router();
const { audit } = require('../services/audit');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../services/util');
const { SETTING_DEFS, getSettings, saveSettings } = require('../services/settings');

// ค่าตั้งค่าทั้งหมด (ไม่มีข้อมูลลับ จึงเปิดให้อ่านได้)
router.get('/settings', asyncHandler(async (req, res) => {
    const values = await getSettings();
    const defs = Object.entries(SETTING_DEFS).map(([key, d]) => ({ key, label: d.label }));
    res.json({ values, defs });
}));

router.put('/settings', requireAdmin, asyncHandler(async (req, res) => {
    const values = req.body || {};
    if (values.b_year !== undefined && !/^\d{4}$/.test(String(values.b_year))) {
        return res.status(400).json({ message: 'ปีงบประมาณต้องเป็นตัวเลข 4 หลัก เช่น 2569' });
    }
    if (values.b_year !== undefined) {
        const fy = await pool.query('SELECT 1 FROM fiscal_years WHERE year = $1', [String(values.b_year)]);
        if (!fy.rowCount) return res.status(400).json({ message: `ยังไม่มีปีงบประมาณ ${values.b_year} — เพิ่มที่เมนู "ปีงบประมาณ" ก่อน` });
    }
    await saveSettings(values);
    audit(req, 'settings.update', 'แก้ไขการตั้งค่าระบบ', { detail: values });
    res.json({ success: true, values: await getSettings() });
}));

// ===== หน่วยบริการ =====
router.get('/units', asyncHandler(async (req, res) => {
    const all = req.query.all === '1';
    const r = await pool.query(
        `SELECT hoscode, name, short_name, sort_order, active FROM units ${all ? '' : 'WHERE active'} ORDER BY sort_order, hoscode`
    );
    res.json(r.rows);
}));

router.post('/units', requireAdmin, asyncHandler(async (req, res) => {
    const { hoscode, name, short_name, active } = req.body || {};
    if (!hoscode || !/^[0-9A-Za-z]{1,10}$/.test(hoscode) || !name) {
        return res.status(400).json({ message: 'กรุณากรอกรหัสหน่วยบริการ (ตัวเลข/ตัวอักษร ไม่เกิน 10 ตัว) และชื่อ' });
    }
    const max = await pool.query('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM units');
    try {
        await pool.query(
            'INSERT INTO units (hoscode, name, short_name, sort_order, active) VALUES ($1,$2,$3,$4,$5)',
            [hoscode, name, short_name || null, max.rows[0].n, active !== false]
        );
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'มีรหัสหน่วยบริการนี้แล้ว' });
        throw err;
    }
    audit(req, 'unit.create', `เพิ่มหน่วยบริการ ${hoscode} ${name}`);
    res.json({ success: true });
}));

router.put('/units/:hoscode', requireAdmin, asyncHandler(async (req, res) => {
    const { name, short_name, active } = req.body || {};
    if (!name) return res.status(400).json({ message: 'กรุณากรอกชื่อหน่วยบริการ' });
    const r = await pool.query(
        'UPDATE units SET name = $1, short_name = $2, active = $3 WHERE hoscode = $4',
        [name, short_name || null, active !== false, req.params.hoscode]
    );
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบหน่วยบริการ' });
    audit(req, 'unit.update', `แก้ไขหน่วยบริการ ${req.params.hoscode} ${name}${active === false ? ' (ปิดใช้งาน)' : ''}`);
    res.json({ success: true });
}));

router.delete('/units/:hoscode', requireAdmin, asyncHandler(async (req, res) => {
    const r = await pool.query('DELETE FROM units WHERE hoscode = $1 RETURNING name', [req.params.hoscode]);
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบหน่วยบริการ' });
    audit(req, 'unit.delete', `ลบหน่วยบริการ ${req.params.hoscode} ${r.rows[0].name}`, { level: 'warn' });
    res.json({ success: true });
}));

router.post('/units/reorder', requireAdmin, asyncHandler(async (req, res) => {
    const codes = Array.isArray(req.body && req.body.hoscodes) ? req.body.hoscodes : null;
    if (!codes) return res.status(400).json({ message: 'ต้องส่ง hoscodes เป็น array' });
    await pool.query(
        `UPDATE units u SET sort_order = x.ord FROM unnest($1::text[]) WITH ORDINALITY AS x(code, ord) WHERE u.hoscode = x.code`,
        [codes]
    );
    res.json({ success: true });
}));

// ค้นหาหน่วยบริการจากตาราง chospital (ใช้ตอนเพิ่มหน่วย)
router.get('/chospital/search', requireAdmin, asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const settings = await getSettings();
    const params = [];
    let where = 'TRUE';
    if (q) {
        params.push(`%${q}%`);
        where = `(hoscode ILIKE $1 OR hosname ILIKE $1)`;
    } else {
        params.push(settings.amp_code);
        where = `amp_code = $1`;
    }
    const r = await pool.query(
        `SELECT hoscode, hosname, amp_name, chw_name FROM chospital WHERE ${where} ORDER BY hoscode LIMIT 50`,
        params
    );
    res.json(r.rows);
}));

module.exports = router;
