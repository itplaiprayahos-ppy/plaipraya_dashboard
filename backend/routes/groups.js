const express = require('express');
const router = express.Router();
const { audit } = require('../services/audit');

// id ต้องเป็นตัวเลขเท่านั้น
router.param('id', (req, res, next, id) => (/^\d+$/.test(id) ? next() : res.status(400).json({ message: 'id ไม่ถูกต้อง' })));
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../services/util');
const { getSettings } = require('../services/settings');

const SLUG_RE = /^[a-z0-9-]{2,50}$/;

function readGroup(body) {
    const b = body || {};
    return {
        slug: String(b.slug || '').trim().toLowerCase(),
        name: String(b.name || '').trim(),
        icon: String(b.icon || 'chart-bar').trim(),
        color1: String(b.color1 || '#0575e6').trim(),
        color2: String(b.color2 || '#021b79').trim(),
        show_on_home: b.show_on_home !== false,
        active: b.active !== false,
    };
}

function validate(g) {
    if (!SLUG_RE.test(g.slug)) return 'รหัสกลุ่ม (slug) ใช้ได้เฉพาะ a-z, 0-9, - ยาว 2-50 ตัว';
    if (!g.name) return 'กรุณากรอกชื่อกลุ่ม';
    if (!/^[a-z0-9-]{1,50}$/.test(g.icon)) return 'ชื่อไอคอนไม่ถูกต้อง';
    if (!/^#[0-9a-fA-F]{3,8}$/.test(g.color1) || !/^#[0-9a-fA-F]{3,8}$/.test(g.color2)) return 'สีต้องอยู่ในรูปแบบ #RRGGBB';
    return null;
}

router.get('/groups', asyncHandler(async (req, res) => {
    const all = req.query.all === '1';
    const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : (await getSettings()).b_year;
    const r = await pool.query(
        `SELECT g.*, (SELECT COUNT(*)::int FROM kpis k WHERE k.group_id = g.id AND k.b_year = $1 AND k.active AND NOT k.is_header) AS kpi_count
         FROM kpi_groups g ${all ? '' : 'WHERE g.active'} ORDER BY g.sort_order, g.id`,
        [year]
    );
    res.json(r.rows);
}));

router.post('/groups', requireAdmin, asyncHandler(async (req, res) => {
    const g = readGroup(req.body);
    const err = validate(g);
    if (err) return res.status(400).json({ message: err });
    try {
        const r = await pool.query(
            `INSERT INTO kpi_groups (slug, name, icon, color1, color2, show_on_home, active, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX(sort_order),0)+1 FROM kpi_groups)) RETURNING *`,
            [g.slug, g.name, g.icon, g.color1, g.color2, g.show_on_home, g.active]
        );
        audit(req, 'group.create', `เพิ่มกลุ่ม "${g.name}" (${g.slug})`, { detail: g });
        res.json(r.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ message: 'รหัสกลุ่มนี้มีอยู่แล้ว' });
        throw e;
    }
}));

router.put('/groups/:id', requireAdmin, asyncHandler(async (req, res) => {
    const g = readGroup(req.body);
    const err = validate(g);
    if (err) return res.status(400).json({ message: err });
    try {
        const r = await pool.query(
            `UPDATE kpi_groups SET slug=$1, name=$2, icon=$3, color1=$4, color2=$5, show_on_home=$6, active=$7
             WHERE id=$8 RETURNING *`,
            [g.slug, g.name, g.icon, g.color1, g.color2, g.show_on_home, g.active, req.params.id]
        );
        if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบกลุ่ม' });
        audit(req, 'group.update', `แก้ไขกลุ่ม "${g.name}" (${g.slug})`, { detail: g });
        res.json(r.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ message: 'รหัสกลุ่มนี้มีอยู่แล้ว' });
        throw e;
    }
}));

router.delete('/groups/:id', requireAdmin, asyncHandler(async (req, res) => {
    const r = await pool.query('DELETE FROM kpi_groups WHERE id = $1 RETURNING name', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบกลุ่ม' });
    audit(req, 'group.delete', `ลบกลุ่ม "${r.rows[0].name}" (รวมตัวชี้วัดในกลุ่ม)`, { level: 'warn' });
    res.json({ success: true });
}));

router.post('/groups/reorder', requireAdmin, asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number) : null;
    if (!ids) return res.status(400).json({ message: 'ต้องส่ง ids เป็น array' });
    await pool.query(
        `UPDATE kpi_groups g SET sort_order = x.ord FROM unnest($1::int[]) WITH ORDINALITY AS x(id, ord) WHERE g.id = x.id`,
        [ids]
    );
    res.json({ success: true });
}));

module.exports = router;
