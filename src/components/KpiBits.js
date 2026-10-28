import { fmtNum } from '../utils/kpi';

// แถบผลลัพธ์ + ตัวเลข (เขียว = ผ่าน, แดง = ไม่ผ่าน)
export function ResultBar({ value, unit = '%', pass, hasData, max = 100 }) {
    if (!hasData) {
        return <div className="result na"><div className="bar" /><b>-</b></div>;
    }
    const w = Math.max(2, Math.min(100, (Number(value) / (max || 100)) * 100));
    return (
        <div className={`result ${pass ? '' : 'bad'}`}>
            <div className="bar"><i style={{ width: `${w}%` }} /></div>
            <b>{fmtNum(value)}{unit}</b>
        </div>
    );
}

export function StatusPill({ pass, hasData }) {
    if (!hasData) return <span className="pill na">ยังไม่มีข้อมูล</span>;
    return pass ? <span className="pill ok">ผ่าน</span> : <span className="pill bad">ไม่ผ่าน</span>;
}

// สถานะของตัวชี้วัดจากค่าที่คำนวณแล้ว: 'pass' | 'fail' | 'nodata'
export function kpiStatus(k) {
    if (!k.value || !k.value.has_data) return 'nodata';
    return k.value.pass ? 'pass' : 'fail';
}
