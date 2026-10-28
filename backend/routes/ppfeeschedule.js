// PP Fee Schedule
const express = require('express');
const router = express.Router();
const { audit } = require('../services/audit');
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { generateTimestampId, asyncHandler } = require('../services/util');

const DATA_FIELDS = ['service_unit_code', 'service_unit_name', 'main_activity', 'sub_activity', 'person_count', 'service_count', 'amount'];

function readData(body) {
    const b = body || {};
    const d = {};
    for (const f of DATA_FIELDS) d[f] = b[f];
    for (const f of ['person_count', 'service_count', 'amount']) {
        d[f] = d[f] === '' || d[f] === undefined || d[f] === null ? 0 : Number(d[f]);
    }
    return d;
}

function validateData(d) {
    if (!d.service_unit_code || !d.service_unit_name || !d.main_activity || !d.sub_activity) return 'กรุณากรอกข้อมูลให้ครบถ้วน';
    if ([d.person_count, d.service_count, d.amount].some(n => !Number.isFinite(n))) return 'จำนวนคน/ครั้ง/เงิน ต้องเป็นตัวเลข';
    return null;
}

router.get('/ppfee/years', asyncHandler(async (req, res) => {
    const r = await pool.query('SELECT * FROM ppfee_years ORDER BY year DESC');
    res.json(r.rows);
}));

router.get('/ppfee/data/:yearId', asyncHandler(async (req, res) => {
    const r = await pool.query('SELECT * FROM ppfee_data WHERE year_id = $1 ORDER BY created_at ASC', [req.params.yearId]);
    res.json(r.rows);
}));

router.get('/ppfee/:year', asyncHandler(async (req, res) => {
    if (!/^\d{4}$/.test(req.params.year)) return res.status(400).json({ success: false, message: 'ปีไม่ถูกต้อง' });
    const r = await pool.query('SELECT * FROM ppfee_years WHERE year = $1', [req.params.year]);
    if (!r.rowCount) return res.status(404).json({ success: false, message: 'Not found years select' });
    res.json({ success: true, data: r.rows });
}));

router.post('/ppfee/years', requireAdmin, asyncHandler(async (req, res) => {
    const { year, status } = req.body || {};
    if (!/^\d{4}$/.test(String(year))) return res.status(400).json({ message: 'ปีงบประมาณต้องเป็นตัวเลข 4 หลัก' });
    const check = await pool.query('SELECT 1 FROM ppfee_years WHERE year = $1', [year]);
    if (check.rowCount) return res.status(400).json({ message: 'ปีงบประมาณนี้มีอยู่แล้ว' });
    await pool.query('INSERT INTO ppfee_years (id, year, status) VALUES ($1, $2, $3) ON CONFLICT (year) DO NOTHING',
        [generateTimestampId(), year, status === 'inactive' ? 'inactive' : 'active']);
    audit(req, 'ppfee.year_create', `เพิ่มปี PP Fee ${year}`);
    res.json({ success: true });
}));

router.put('/ppfee/years/:id', requireAdmin, asyncHandler(async (req, res) => {
    const status = req.body && req.body.status === 'inactive' ? 'inactive' : 'active';
    const r = await pool.query('UPDATE ppfee_years SET status = $1 WHERE id = $2', [status, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ success: false, message: 'ไม่พบปีงบประมาณ' });
    audit(req, 'ppfee.year_status', `เปลี่ยนสถานะปี PP Fee เป็น ${status}`, { detail: { id: req.params.id, status } });
    res.json({ success: true });
}));

router.post('/ppfee/data/:yearId', requireAdmin, asyncHandler(async (req, res) => {
    const d = readData(req.body);
    const err = validateData(d);
    if (err) return res.status(400).json({ success: false, message: err });
    const y = await pool.query('SELECT 1 FROM ppfee_years WHERE id = $1', [req.params.yearId]);
    if (!y.rowCount) return res.status(404).json({ success: false, message: 'Not found years select' });
    const r = await pool.query(
        `INSERT INTO ppfee_data (id, year_id, service_unit_code, service_unit_name, main_activity, sub_activity, person_count, service_count, amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [generateTimestampId(), req.params.yearId, d.service_unit_code, d.service_unit_name, d.main_activity, d.sub_activity,
         d.person_count, d.service_count, d.amount]
    );
    audit(req, 'ppfee.create', `เพิ่มกิจกรรม PP Fee ${d.service_unit_code} ${d.sub_activity}`, { detail: d });
    res.json({ success: true, message: 'เพิ่มข้อมูลกิจกรรมสำเร็จ', data: r.rows[0] });
}));

router.put('/ppfee/data/:id', requireAdmin, asyncHandler(async (req, res) => {
    const d = readData(req.body);
    const err = validateData(d);
    if (err) return res.status(400).json({ success: false, message: err });
    const r = await pool.query(
        `UPDATE ppfee_data SET service_unit_code=$1, service_unit_name=$2, main_activity=$3, sub_activity=$4,
                person_count=$5, service_count=$6, amount=$7, updated_at=CURRENT_TIMESTAMP
         WHERE id=$8 RETURNING *`,
        [d.service_unit_code, d.service_unit_name, d.main_activity, d.sub_activity, d.person_count, d.service_count, d.amount, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
    audit(req, 'ppfee.update', `แก้ไขกิจกรรม PP Fee ${d.service_unit_code} ${d.sub_activity}`, { detail: d });
    res.json({ success: true, message: 'แก้ไขข้อมูลสำเร็จ', data: r.rows[0] });
}));

router.delete('/ppfee/data/:id', requireAdmin, asyncHandler(async (req, res) => {
    const r = await pool.query('DELETE FROM ppfee_data WHERE id = $1 RETURNING *', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ success: false, message: 'Data not found' });
    audit(req, 'ppfee.delete', `ลบกิจกรรม PP Fee ${r.rows[0].service_unit_code} ${r.rows[0].sub_activity}`, { level: 'warn' });
    res.json({ success: true, message: 'Deleted successfully', deleted: r.rows[0] });
}));

module.exports = router;
