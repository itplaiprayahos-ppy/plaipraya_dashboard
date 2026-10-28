import { Card, Col, Row } from 'react-bootstrap';
import { FaList, FaTimesCircle, FaCheckCircle, FaPercentage } from 'react-icons/fa';

function StatCard({ title, value, icon: Icon, from, to }) {
    return (
        <Card style={{
            background: `linear-gradient(135deg, ${from}, ${to})`, borderRadius: 15, color: 'white',
            padding: 20, position: 'relative', overflow: 'hidden', minWidth: 220, border: 'none',
        }}>
            <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', top: -40, right: -40 }} />
            <div style={{ position: 'absolute', width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: 20, right: 20 }} />
            <Card.Body className="text-center" style={{ position: 'relative', zIndex: 1 }}>
                <Icon size={28} color="#fff" />
                <h6 className="mt-3 mb-1">{title}</h6>
                <h5 className="mb-3 mt-2" style={{ fontWeight: 700, color: '#fff' }}>{value}</h5>
            </Card.Body>
        </Card>
    );
}

// การ์ดสรุป 4 ใบ: ทั้งหมด / ผ่าน / ไม่ผ่าน / ร้อยละ
export default function StatCards({ kpis }) {
    const items = kpis.filter(k => !k.is_header);
    const total = items.length;
    const passed = items.filter(k => k.value && k.value.pass).length;
    const percent = total ? ((passed / total) * 100).toFixed(1) : '0.0';
    return (
        <Row className="g-4">
            <Col lg={3} md={6} xs={12}><StatCard title="รวมทั้งหมด" value={`${total} ตัวชี้วัด`} icon={FaList} from="#4286f4" to="#373b44" /></Col>
            <Col lg={3} md={6} xs={12}><StatCard title="ผ่านแล้ว" value={`${passed} ตัวชี้วัด`} icon={FaCheckCircle} from="#2ecc71" to="#27ae60" /></Col>
            <Col lg={3} md={6} xs={12}><StatCard title="ยังไม่ผ่าน" value={`${total - passed} ตัวชี้วัด`} icon={FaTimesCircle} from="#e74c3c" to="#c0392b" /></Col>
            <Col lg={3} md={6} xs={12}><StatCard title="ร้อยละ" value={`${percent}%`} icon={FaPercentage} from="#f1c40f" to="#f39c12" /></Col>
        </Row>
    );
}
