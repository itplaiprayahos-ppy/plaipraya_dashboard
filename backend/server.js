const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

if (!process.env.COOKIE_SECRET) {
    console.error('❌ ยังไม่ได้ตั้ง COOKIE_SECRET ใน backend/.env (ล็อกอินจะใช้ไม่ได้)');
    process.exit(1);
}

const isDev = (process.env.ENVIRONMENT || process.env.NODE_ENV || 'development') === 'development';
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(s => s.trim());

const app = express();
app.set('trust proxy', 1);

// cors ต้องมาก่อน middleware อื่น เพื่อให้ทุก response (รวม 429/500) มี header CORS
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
}));
app.use(helmet());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests' },
    skip: () => isDev,
}));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/user'));
app.use('/api', require('./routes/settings'));
app.use('/api', require('./routes/groups'));
app.use('/api', require('./routes/years'));
app.use('/api', require('./routes/kpis'));
app.use('/api', require('./routes/hdc'));
app.use('/api', require('./routes/ppfeeschedule'));
app.use('/api', require('./routes/logs'));

// 404
app.use((req, res) => {
    res.status(404).json({ message: 'Not found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // ฐานข้อมูลเชื่อมต่อไม่ได้ / รหัสผ่านผิด / ไม่มีตาราง (ยังไม่ได้ npm run setup)
    if (['ECONNREFUSED', 'ENOTFOUND', '28P01', '3D000'].includes(err.code)) {
        console.error('Database error:', err.message);
        return res.status(503).json({ message: `เชื่อมต่อฐานข้อมูลไม่ได้: ${err.message}` });
    }
    if (err.code === '42P01' || err.code === '42883' || err.code === '42703') {
        console.error('Database schema error:', err.message);
        return res.status(500).json({ message: `ฐานข้อมูลยังไม่ครบ กรุณารัน npm run setup (${err.message})` });
    }
    const status = err.statusCode || err.status || 500;
    if (status >= 500) {
        if (!err.statusCode) console.error(err);
        const action = /\/sync/.test(req.path) ? 'hdc.sync_failed' : 'system.error';
        require('./services/audit').audit(req, action, `${req.method} ${req.originalUrl}: ${err.message}`, { level: 'error' });
    }
    res.status(status).json({ message: status >= 500 && !err.statusCode ? 'Server error' : err.message });
});

const port = process.env.PORT || 4000;
if (require.main === module) {
    require('./db/migrate').migrate()
        .catch(err => console.error('⚠️  อัปเดตโครงสร้างฐานข้อมูลไม่สำเร็จ:', err.message))
        .finally(() => app.listen(port, () => console.log(`Server is running on port ${port}`)));
}

module.exports = app;
