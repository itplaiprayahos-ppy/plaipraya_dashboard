// ตัวช่วยทั่วไป
function generateTimestampId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return (BigInt(timestamp) * 1000n + BigInt(random)).toString();
}

// ชื่อตาราง/ฟิลด์ของ HDC: อนุญาตเฉพาะ a-z A-Z 0-9 _
const IDENT_RE = /^[A-Za-z0-9_]{1,100}$/;
const isIdent = (s) => typeof s === 'string' && IDENT_RE.test(s);

function toNumberOrNull(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
    constructor(status, message) { super(message); this.statusCode = status; }
}

module.exports = { generateTimestampId, isIdent, toNumberOrNull, asyncHandler, HttpError };
