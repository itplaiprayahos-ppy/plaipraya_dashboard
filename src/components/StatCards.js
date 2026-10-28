import { FiCheckCircle, FiList, FiPercent, FiXCircle } from 'react-icons/fi';

function Stat({ icon: Icon, tone, title, value, unit }) {
    return (
        <div className="stat">
            <div className={`stat-ic tone-${tone}`}><Icon size={24} /></div>
            <div>
                <small>{title}</small>
                <b>{value}</b>
                <em>{unit}</em>
            </div>
        </div>
    );
}

// การ์ดสรุป 4 ใบ: ทั้งหมด / ผ่าน / ไม่ผ่าน / อัตราผ่าน
export default function StatCards({ kpis }) {
    const items = kpis.filter(k => !k.is_header);
    const total = items.length;
    const passed = items.filter(k => k.value && k.value.pass).length;
    const percent = total ? ((passed / total) * 100).toFixed(1) : '0.0';
    return (
        <div className="stat-grid">
            <Stat icon={FiList} tone="blue" title="ตัวชี้วัดทั้งหมด" value={total} unit="รายการ" />
            <Stat icon={FiCheckCircle} tone="green" title="ผ่านเกณฑ์" value={passed} unit="ตัวชี้วัด" />
            <Stat icon={FiXCircle} tone="red" title="ยังไม่ผ่าน" value={total - passed} unit="ตัวชี้วัด" />
            <Stat icon={FiPercent} tone="amber" title="อัตราผ่านเกณฑ์" value={`${percent}%`} unit="ของทั้งหมด" />
        </div>
    );
}
