// บันทึกการใช้งานลงตาราง audit_logs (ไม่ทำให้คำขอหลักล้มถ้าบันทึกไม่สำเร็จ)
const pool = require('../config/db');
const logger = require('../logger');

function clientIp(req) {
    if (!req) return null;
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || '';
    return ip.replace(/^::ffff:/, '') || null;
}

/**
 * @param {object} req   express request (ใช้หา user + ip) หรือ null
 * @param {string} action เช่น 'auth.login'
 * @param {string} message ข้อความที่อ่านเข้าใจได้
 * @param {object} [opts] { level, detail, username }
 */
function audit(req, action, message, opts = {}) {
    const user = req && req.user;
    const username = opts.username || (user && user.username) || null;
    const userName = user ? (`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username) : null;
    const level = opts.level || 'info';
    const line = `[${action}] ${username || '-'} ${message}`;
    if (level === 'error') logger.error(line); else if (level === 'warn') logger.warn(line); else logger.info(line);
    pool.query(
        `INSERT INTO audit_logs (level, action, username, user_name, ip, message, detail) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [level, action, username, userName, clientIp(req), message, opts.detail ? JSON.stringify(opts.detail) : null]
    ).catch(err => console.error('บันทึก audit log ไม่สำเร็จ:', err.message));
}

module.exports = { audit, clientIp };
