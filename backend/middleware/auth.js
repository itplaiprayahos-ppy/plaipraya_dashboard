const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// อ่าน token จาก cookie แล้วโหลดผู้ใช้จากฐานข้อมูล (ไม่ error ถ้าไม่ได้ล็อกอิน)
async function loadUser(req) {
    if (req.user !== undefined) return req.user;
    req.user = null;
    const token = req.cookies && req.cookies.token;
    if (!token) return null;
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.COOKIE_SECRET);
    } catch {
        return null;
    }
    const result = await pool.query(
        'SELECT id, username, email, first_name, last_name, department, role FROM users WHERE username = $1',
        [decoded.username]
    );
    req.user = result.rows[0] || null;
    return req.user;
}

// มี 2 สิทธิ์: user = ดูอย่างเดียว, admin = ตั้งค่า/ซิงค์/กรอกข้อมูลได้ทั้งหมด
const isAdminRole = (role) => role === 'admin';

function displayName(user) {
    if (!user) return '';
    const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return full || user.username;
}

const requireLogin = async (req, res, next) => {
    try {
        const user = await loadUser(req);
        if (!user) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });
        next();
    } catch (err) {
        next(err);
    }
};

const requireAdmin = async (req, res, next) => {
    try {
        const user = await loadUser(req);
        if (!user) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบ' });
        if (!isAdminRole(user.role)) return res.status(403).json({ message: 'สำหรับผู้ดูแลระบบเท่านั้น' });
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = { loadUser, requireLogin, requireAdmin, displayName, isAdminRole };
