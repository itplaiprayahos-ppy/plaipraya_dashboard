const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const { loadUser } = require('../middleware/auth');
const { generateTimestampId, asyncHandler } = require('../services/util');
const { audit } = require('../services/audit');

const isProd = process.env.NODE_ENV === 'production' || process.env.ENVIRONMENT === 'production';

// จำกัดการลองรหัสผ่าน: 20 ครั้ง / 15 นาที / IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        audit(req, 'auth.rate_limited', 'พยายามเข้าสู่ระบบ/สมัครบ่อยเกินไป ถูกระงับชั่วคราว', {
            level: 'warn', username: req.body && req.body.username ? String(req.body.username).slice(0, 64) : null,
        });
        res.status(options.statusCode).json({ loggedIn: false, status: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาที' });
    },
});

const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Strict',
};

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ loggedIn: false, status: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }
    const r = await pool.query(
        'SELECT id, username, password, first_name, last_name, role FROM users WHERE username = $1',
        [username]
    );
    const user = r.rows[0];
    const ok = user && await bcrypt.compare(password, user.password);
    if (!ok) {
        audit(req, 'auth.login_failed', user ? 'รหัสผ่านไม่ถูกต้อง' : 'ไม่พบชื่อผู้ใช้', { level: 'warn', username: String(username).slice(0, 64) });
        return res.status(401).json({ loggedIn: false, status: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    const token = jwt.sign({ username: user.username }, process.env.COOKIE_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });
    req.user = { username: user.username, first_name: user.first_name, last_name: user.last_name };
    audit(req, 'auth.login', 'เข้าสู่ระบบ');
    res.json({ loggedIn: true, username: user.username, role: user.role });
}));

router.post('/signup', loginLimiter, asyncHandler(async (req, res) => {
    const { username, password, email, first_name, last_name, department } = req.body || {};
    if (!username || !password || !email) {
        return res.status(400).json({ loggedIn: false, status: 'กรุณากรอกข้อมูลให้ครบ' });
    }
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
        return res.status(400).json({ loggedIn: false, status: 'ชื่อผู้ใช้ต้องเป็น a-z, 0-9, _ . - ยาว 3-32 ตัว' });
    }
    if (String(password).length < 8) {
        return res.status(400).json({ loggedIn: false, status: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
    }
    const dupUser = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (dupUser.rowCount) return res.json({ loggedIn: false, status: 'Username taken' });
    const dupEmail = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (dupEmail.rowCount) return res.json({ loggedIn: false, status: 'Email taken' });

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
        `INSERT INTO users (id, username, password, email, first_name, last_name, department, role)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'user')`,
        [generateTimestampId(), username, hashed, email, first_name || null, last_name || null, department || null]
    );
    audit(req, 'auth.signup', `สมัครสมาชิก (${email})`, { username });
    res.json({ loggedIn: true, username });
}));

router.get('/logout', asyncHandler(async (req, res) => {
    const user = await loadUser(req).catch(() => null);
    res.clearCookie('token', cookieOptions);
    if (user) audit(req, 'auth.logout', 'ออกจากระบบ');
    res.json({ message: 'Logged out successfully' });
}));

router.get('/checkAuth', asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    if (!user) return res.json({ loggedIn: false });
    res.json({
        loggedIn: true,
        id: user.id,
        username: user.username,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
    });
}));

module.exports = router;
