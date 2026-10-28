import { useEffect, useState } from 'react';
import { Accordion, Alert, Col, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import api, { errMsg } from '../api';
import { useAppData } from '../context/AppDataContext';
import { useAlerts } from '../context/AlertsContext';
import { FiAlertTriangle, FiXCircle } from 'react-icons/fi';
import { FullPageLoading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import StatCards from '../components/StatCards';
import { ResultBar, kpiStatus } from '../components/KpiBits';

function GroupCard({ g }) {
    const items = g.kpis.filter(k => !k.is_header);
    const n = { pass: 0, fail: 0, nodata: 0 };
    items.forEach(k => { n[kpiStatus(k)]++; });
    const total = items.length || 1;
    const pct = items.length ? ((n.pass / items.length) * 100).toFixed(1) : '0.0';
    return (
        <Link to={`/kpi/${g.slug}`} className="group-card">
            <div className="gc-top">
                <span className="gc-ic" style={{ background: `linear-gradient(135deg, ${g.color1}, ${g.color2})` }}>
                    <i className={`fa fa-${g.icon || 'chart-bar'}`} />
                </span>
                <div className="flex-grow-1">
                    <h3>{g.name}</h3>
                    <small className="text-muted">{items.length} ตัวชี้วัด</small>
                </div>
                <FiArrowRight className="text-muted" />
            </div>
            <div className="gc-nums">
                <div><small>ผ่าน</small><b style={{ color: 'var(--ok-text)' }}>{n.pass}</b></div>
                <div><small>ไม่ผ่าน</small><b style={{ color: 'var(--bad-text)' }}>{n.fail}</b></div>
                <div><small>ยังไม่มีข้อมูล</small><b className="text-muted">{n.nodata}</b></div>
            </div>
            <div className="gc-bar">
                <i style={{ width: `${(n.pass / total) * 100}%`, background: 'var(--ok)' }} />
                <i style={{ width: `${(n.fail / total) * 100}%`, background: 'var(--bad)' }} />
            </div>
            <div className="gc-foot"><span>อัตราผ่านเกณฑ์</span><b style={{ color: 'var(--text)' }}>{pct}%</b></div>
        </Link>
    );
}

function HomePage() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const { year } = useAppData();
    const { data: alerts } = useAlerts();

    useEffect(() => {
        if (!year) return;
        setData(null);
        api.get('/home', { params: { year } })
            .then(res => setData(res.data))
            .catch(err => setError(errMsg(err, 'โหลดข้อมูลไม่สำเร็จ')));
    }, [year]);

    if (error) return <div className="page"><Alert variant="danger">{error}</Alert></div>;
    if (!data) return <FullPageLoading />;

    const allKpis = data.groups.flatMap(g => g.kpis);
    const totalKpis = allKpis.filter(k => !k.is_header).length;

    return (
        <div className="page">
            <PageHeader title="ภาพรวมตัวชี้วัด" sub={`ปีงบประมาณ ${data.year} · ทุกกลุ่มตัวชี้วัด`} />

            {data.groups.length === 0 && (
                <Alert variant="info">ยังไม่มีกลุ่มตัวชี้วัด — ผู้ดูแลระบบเพิ่มได้ที่เมนู "กลุ่มตัวชี้วัด"</Alert>
            )}
            {data.groups.length > 0 && totalKpis === 0 && (
                <Alert variant="info">
                    ปีงบประมาณ {data.year} ยังไม่มีตัวชี้วัด — ผู้ดูแลระบบเพิ่มได้ที่เมนู "จัดการตัวชี้วัด" หรือคัดลอกจากปีก่อนที่เมนู "ปีงบประมาณ"
                </Alert>
            )}

            {alerts && alerts.alerts.length > 0 && (
                <div className={`alert-banner ${alerts.summary.sync_failed ? 'danger' : 'warning'}`}>
                    <span className="ab-ic">{alerts.summary.sync_failed ? <FiXCircle size={20} /> : <FiAlertTriangle size={20} />}</span>
                    <div className="ab-text">
                        <b>ข้อมูล HDC ต้องตรวจสอบ {alerts.alerts.length} ตาราง</b>
                        <small>
                            {[
                                alerts.summary.sync_failed && `ซิงค์ล้มเหลว ${alerts.summary.sync_failed}`,
                                alerts.summary.stale && `ไม่ได้อัปเดตเกิน ${alerts.stale_days} วัน ${alerts.summary.stale}`,
                                alerts.summary.never_synced && `ยังไม่เคยซิงค์ ${alerts.summary.never_synced}`,
                            ].filter(Boolean).join(' · ')} (เห็นเฉพาะผู้ดูแลระบบ)
                        </small>
                    </div>
                    <Link to="/admin/hdc" className={`btn ${alerts.summary.sync_failed ? 'btn-danger' : 'btn-warning'}`}>ดูรายละเอียด</Link>
                </div>
            )}

            {totalKpis > 0 && <StatCards kpis={allKpis} />}

            <Row className="g-3 mb-4">
                {data.groups.map(g => (
                    <Col md={6} xl={4} key={g.id}><GroupCard g={g} /></Col>
                ))}
            </Row>

            {totalKpis > 0 && (
                <div className="panel">
                    <div className="panel-head"><h3>สรุปผลรายตัวชี้วัด</h3></div>
                    <Accordion defaultActiveKey={data.groups.length ? String(data.groups[0].id) : undefined} flush>
                        {data.groups.filter(g => g.kpis.length).map(g => (
                            <Accordion.Item eventKey={String(g.id)} key={g.id}>
                                <Accordion.Header>
                                    <span className="d-flex align-items-center gap-2 w-100 me-3">
                                        <i className={`fa fa-${g.icon || 'chart-bar'}`} style={{ color: g.color1, width: 18 }} />
                                        <span className="fw-semibold flex-grow-1">{g.name}</span>
                                        <Link to={`/kpi/${g.slug}`} className="small fw-semibold" onClick={e => e.stopPropagation()}>
                                            ดูรายละเอียด
                                        </Link>
                                    </span>
                                </Accordion.Header>
                                <Accordion.Body className="p-0">
                                    {g.kpis.map(k => {
                                        const label = `${k.display_index ? k.display_index + '. ' : ''}${k.name}`;
                                        if (k.is_header) return <div key={k.id} className="kpi-line head">{label}</div>;
                                        return (
                                            <div key={k.id} className="kpi-line">
                                                <Link to={`/kpi/${g.slug}/detail/${k.id}`} className={`nm ${k.display_index ? '' : 'sub'}`} style={{ color: 'var(--text)' }}>
                                                    {label}
                                                </Link>
                                                <ResultBar
                                                    value={k.value.percent} unit={k.unit_label || ''} pass={k.value.pass}
                                                    hasData={k.value.has_data} max={Number(k.multiplier) === 100 ? 100 : Math.max(k.value.percent, k.criterion || 0) * 1.2}
                                                />
                                            </div>
                                        );
                                    })}
                                </Accordion.Body>
                            </Accordion.Item>
                        ))}
                    </Accordion>
                </div>
            )}
        </div>
    );
}

export default HomePage;
