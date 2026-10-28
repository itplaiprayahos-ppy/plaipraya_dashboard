import { useEffect, useState } from 'react';
import { Accordion, Alert, Card, Col, Container, ProgressBar, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import KpiCard from '../components/KpiCard';
import { useAppData } from '../context/AppDataContext';
import { FullPageLoading } from '../components/Loading';
import { fmtNum } from '../utils/kpi';

const groupIcon = (icon) => () => <i className={`fa fa-${icon || 'chart-bar'}`} style={{ fontSize: 20 }} />;

function HomePage() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const { year } = useAppData();

    useEffect(() => {
        if (!year) return;
        setData(null);
        api.get('/home', { params: { year } })
            .then(res => setData(res.data))
            .catch(err => setError(errMsg(err, 'โหลดข้อมูลไม่สำเร็จ')));
    }, [year]);

    if (error) return <Container className="py-5"><Alert variant="danger">{error}</Alert></Container>;
    if (!data) return <FullPageLoading />;
    const totalKpis = data.groups.reduce((a, g) => a + g.kpis.filter(k => !k.is_header).length, 0);

    return (
        <Container fluid style={{ backgroundColor: '#f8f9fa', padding: '25px' }}>
            <Row>
                <h2 className="text-start my-3" style={{ fontWeight: 700, color: '#2c3e50' }}>หน้าหลัก</h2>
            </Row>

            <Row className="g-4">
                {data.groups.map(g => {
                    const items = g.kpis.filter(k => !k.is_header);
                    const passed = items.filter(k => k.value && k.value.pass).length;
                    return (
                        <Col md={6} xl={4} key={g.id}>
                            <KpiCard
                                title={`มีตัวชี้วัดทั้งหมด ${items.length} ตัวชี้วัด · ผ่าน ${passed}`}
                                value={g.name}
                                icon={groupIcon(g.icon)}
                                color={g.color1}
                                gradient={g.color2}
                                path={`/kpi/${g.slug}`}
                            />
                        </Col>
                    );
                })}
            </Row>

            {data.groups.length === 0 && (
                <Alert variant="info" className="mt-4">ยังไม่มีกลุ่มตัวชี้วัด — ผู้ดูแลระบบเพิ่มได้ที่เมนู "กลุ่มตัวชี้วัด"</Alert>
            )}
            {data.groups.length > 0 && totalKpis === 0 && (
                <Alert variant="info" className="mt-4">
                    ปีงบประมาณ {data.year} ยังไม่มีตัวชี้วัด — ผู้ดูแลระบบเพิ่มได้ที่เมนู "จัดการตัวชี้วัด" หรือคัดลอกจากปีก่อนที่เมนู "ปีงบประมาณ"
                </Alert>
            )}

            <Row className="mt-4">
                <Col>
                    <Card>
                        <Card.Header style={{ backgroundColor: '#FFF', fontWeight: 600, fontSize: '1.125rem' }}>
                            สรุปตัวชี้วัด (KPI) ปีงบประมาณ {data.year}
                        </Card.Header>
                        <Card.Body>
                            <Accordion defaultActiveKey={data.groups.length ? String(data.groups[0].id) : undefined}>
                                {data.groups.map(g => (
                                    <Accordion.Item eventKey={String(g.id)} key={g.id}>
                                        <Accordion.Header>
                                            <div className="d-flex justify-content-between align-items-center w-100 flex-wrap">
                                                <strong>{g.name}</strong>
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    className="btn btn-sm mt-2 mt-sm-0"
                                                    style={{ backgroundColor: '#0d9488', color: 'white', borderRadius: 10, padding: '6px 12px', fontWeight: 500, marginRight: '1rem' }}
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/kpi/${g.slug}`); }}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); navigate(`/kpi/${g.slug}`); } }}
                                                >
                                                    รายละเอียด
                                                </div>
                                            </div>
                                        </Accordion.Header>
                                        <Accordion.Body className="bg-light">
                                            <ul className="list-group list-group-flush">
                                                {g.kpis.map(k => {
                                                    const label = `${k.display_index ? k.display_index + ') ' : ''}${k.name}`;
                                                    if (k.is_header) {
                                                        return <li key={k.id} className="list-group-item fw-bold">{label}</li>;
                                                    }
                                                    const v = k.value;
                                                    const isSub = !k.display_index;
                                                    return (
                                                        <li key={k.id} className="list-group-item d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                                                            <span className={`fw-bold ${isSub ? 'ms-4' : ''}`}>{label}</span>
                                                            <div className="d-flex align-items-center" style={{ minWidth: 200 }}>
                                                                <ProgressBar
                                                                    now={v.has_data ? Math.min(100, v.percent) : 0}
                                                                    style={{ minWidth: 120, height: 12 }}
                                                                    variant={v.pass ? 'success' : 'danger'}
                                                                />
                                                                <span className={`ms-2 ${v.has_data ? (v.pass ? 'text-success' : 'text-danger') : 'text-muted'}`}>
                                                                    {v.has_data ? `${fmtNum(v.percent)}${k.unit_label || ''}` : '-'}
                                                                </span>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </Accordion.Body>
                                    </Accordion.Item>
                                ))}
                            </Accordion>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default HomePage;
