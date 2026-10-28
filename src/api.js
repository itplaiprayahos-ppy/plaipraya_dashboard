import axios from 'axios';

// axios ที่ตั้งค่า baseURL + ส่ง cookie ทุกครั้ง
const api = axios.create({
    baseURL: `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000'}/api`,
    withCredentials: true,
});

export function errMsg(error, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่') {
    const d = error && error.response && error.response.data;
    if (d && typeof d === 'object') return d.message || d.status || d.error || fallback;
    if (error && !error.response) return 'ติดต่อเซิร์ฟเวอร์ไม่ได้ (ตรวจว่า backend ทำงานอยู่)';
    return fallback;
}

export default api;
