// ดูบันทึกการใช้งานย้อนหลัง (admin)
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../services/util');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function buildWhere(q) {
    const where = [];
    const params = [];
    const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
    // วันที่ตามเวลาไทย
    if (DATE_RE.test(q.from || '')) add(`at >= (?::date)::timestamp AT TIME ZONE 'Asia/Bangkok'`, q.from);
    if (DATE_RE.test(q.to || '')) add(`at < ((?::date) + 1)::timestamp AT TIME ZONE 'Asia/Bangkok'`, q.to);
    if (q.level && ['info', 'warn', 'error'].includes(q.level)) add('level = ?', q.level);
    if (q.action) {
        // 'auth' = ทุก action ในหมวด auth, 'auth.login' = เฉพาะ action นั้น
        if (q.action.includes('.')) add('action = ?', q.action);
        else add(`action LIKE ? || '.%'`, q.action);
    }
    if (q.username) add('username = ?', q.username);
    if (q.q) {
        params.push(String(q.q));
        const n = params.length;
        where.push(`(message ILIKE '%' || $${n} || '%' OR ip ILIKE '%' || $${n} || '%' OR username ILIKE '%' || $${n} || '%')`);
    }
    return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/admin/logs', requireAdmin, asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { sql, params } = buildWhere(req.query);
    const [rows, total] = await Promise.all([
        pool.query(
            `SELECT id, at, level, action, username, user_name, ip, message, detail
             FROM audit_logs ${sql} ORDER BY at DESC, id DESC
             LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
            params
        ),
        pool.query(`SELECT COUNT(*)::int AS n FROM audit_logs ${sql}`, params),
    ]);
    res.json({ page, limit, total: total.rows[0].n, rows: rows.rows });
}));

// ตัวเลือกสำหรับตัวกรอง + สรุป 7 วันล่าสุด
router.get('/admin/logs/meta', requireAdmin, asyncHandler(async (req, res) => {
    const [actions, users, summary] = await Promise.all([
        pool.query('SELECT DISTINCT action FROM audit_logs ORDER BY action'),
        pool.query('SELECT DISTINCT username FROM audit_logs WHERE username IS NOT NULL ORDER BY username'),
        pool.query(
            `SELECT COUNT(*) FILTER (WHERE action = 'auth.login')::int AS logins,
                    COUNT(*) FILTER (WHERE action = 'auth.login_failed')::int AS login_failed,
                    COUNT(*) FILTER (WHERE level = 'error')::int AS errors,
                    COUNT(DISTINCT username) FILTER (WHERE action = 'auth.login')::int AS active_users
             FROM audit_logs WHERE at >= now() - interval '7 days'`
        ),
    ]);
    res.json({
        actions: actions.rows.map(r => r.action),
        usernames: users.rows.map(r => r.username),
        last7days: summary.rows[0],
    });
}));

module.exports = router;
