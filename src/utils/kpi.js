export const OP_LABEL = { '>=': '≥', '>': '>', '<=': '≤', '<': '<' };

export const OP_OPTIONS = [
    { value: '>=', label: '≥ มากกว่าหรือเท่ากับ (ยิ่งมากยิ่งดี)' },
    { value: '>', label: '> มากกว่า' },
    { value: '<=', label: '≤ น้อยกว่าหรือเท่ากับ (ยิ่งน้อยยิ่งดี เช่น อัตราตาย)' },
    { value: '<', label: '< น้อยกว่า' },
];

export const MULTIPLIER_PRESETS = [
    { value: 100, label: 'ร้อยละ (×100)', unit: '%' },
    { value: 1000, label: 'ต่อพัน (×1,000)', unit: '' },
    { value: 100000, label: 'ต่อแสน (×100,000)', unit: '' },
    { value: 1, label: 'อัตราส่วน (×1)', unit: '' },
];

export const ICON_OPTIONS = [
    'wallet', 'university', 'search', 'star', 'heartbeat', 'hospital', 'chart-bar', 'chart-line',
    'clipboard-check', 'user-md', 'notes-medical', 'flag', 'stethoscope', 'briefcase-medical', 'tasks', 'award',
];

export function formatCriterion(k) {
    if (k.criterion === null || k.criterion === undefined) return '-';
    return `${OP_LABEL[k.criterion_op] || '≥'}${Number(k.criterion).toLocaleString()}${k.unit_label || ''}`;
}

export function fmtNum(n) {
    if (n === null || n === undefined || n === '') return '-';
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
}

// สีของช่องผลลัพธ์
export function passColor(pass, hasData) {
    if (!hasData) return '#f1f3f5';
    return pass ? '#d4edda' : '#f8d7da';
}
