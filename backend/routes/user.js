const express = require('express');
const router = express.Router();
const { audit } = require('../services/audit');
const pool = require('../config/db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const bcrypt = require('bcrypt');
const { asyncHandler } = require('../services/util');

router.get('/profile', requireLogin, asyncHandler(async (req, res) => {
    const r = await pool.query(
        'SELECT id, username, email, first_name, last_name, department, role, created_at, updated_at FROM users WHERE id = $1',
        [req.user.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
}));

// ผู้ใช้แก้ข้อมูลตัวเองได้ แต่เปลี่ยน role ไม่ได้
router.put('/profile', requireLogin, asyncHandler(async (req, res) => {
    const { first_name, last_name, email, department } = req.body || {};
    try {
        const r = await pool.query(
            `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name),
                    email = COALESCE($3, email), department = COALESCE($4, department), updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING id, username, email, first_name, last_name, department, created_at, updated_at, role`,
            [first_name || null, last_name || null, email || null, department || null, req.user.id]
        );
        audit(req, 'user.profile', 'แก้ไขข้อมูลส่วนตัว');
        res.json({ message: 'Profile updated', user: r.rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Email หรือ Username ซ้ำ' });
        throw err;
    }
}));

// เปลี่ยนรหัสผ่านตัวเอง (ต้องใส่รหัสเดิม)
router.put('/profile/password', requireLogin, asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่' });
    if (String(new_password).length < 8) return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
    const r = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (!r.rowCount || !(await bcrypt.compare(current_password, r.rows[0].password))) {
        audit(req, 'user.password_failed', 'เปลี่ยนรหัสผ่านไม่สำเร็จ (รหัสเดิมไม่ถูกต้อง)', { level: 'warn' });
        return res.status(400).json({ message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }
    await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [await bcrypt.hash(new_password, 10), req.user.id]);
    audit(req, 'user.password', 'เปลี่ยนรหัสผ่านตัวเอง');
    res.json({ success: true });
}));

// ===== จัดการผู้ใช้ (admin) =====
router.get('/admin/users', requireAdmin, asyncHandler(async (req, res) => {
    const r = await pool.query(
        'SELECT id, username, email, first_name, last_name, department, role, created_at FROM users ORDER BY created_at'
    );
    res.json(r.rows);
}));

router.put('/admin/users/:id/role', requireAdmin, asyncHandler(async (req, res) => {
    const { role } = req.body || {};
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'สิทธิ์ต้องเป็น user หรือ admin' });
    if (req.params.id === String(req.user.id) && role === 'user') {
        return res.status(400).json({ message: 'ไม่สามารถลดสิทธิ์ตัวเองได้' });
    }
    const r = await pool.query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING username', [role, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    audit(req, 'user.role', `เปลี่ยนสิทธิ์ ${r.rows[0].username} เป็น ${role}`, { detail: { target: r.rows[0].username, role } });
    res.json({ success: true });
}));

// admin ตั้งรหัสผ่านใหม่ให้ผู้ใช้ (กรณีลืมรหัสผ่าน)
router.put('/admin/users/:id/password', requireAdmin, asyncHandler(async (req, res) => {
    const { password } = req.body || {};
    if (!password || String(password).length < 8) return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
    const r = await pool.query(
        'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING username',
        [await bcrypt.hash(password, 10), req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    audit(req, 'user.password_reset', `ตั้งรหัสผ่านใหม่ให้ ${r.rows[0].username}`, { level: 'warn', detail: { target: r.rows[0].username } });
    res.json({ success: true });
}));

router.delete('/admin/users/:id', requireAdmin, asyncHandler(async (req, res) => {
    if (req.params.id === String(req.user.id)) return res.status(400).json({ message: 'ไม่สามารถลบตัวเองได้' });
    const r = await pool.query('DELETE FROM users WHERE id = $1 RETURNING username', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
    audit(req, 'user.delete', `ลบผู้ใช้ ${r.rows[0].username}`, { level: 'warn', detail: { target: r.rows[0].username } });
    res.json({ success: true });
}));

module.exports = router;
