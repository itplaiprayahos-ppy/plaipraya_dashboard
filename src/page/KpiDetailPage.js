import { useEffect, useState } from 'react';
import { Alert, Col, Row, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import {
    BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ReferenceLine, ResponsiveContainer,
    PieChart, Pie,
} from 'recharts';
import { FiArrowLeft, FiExternalLink, FiTarget, FiTrendingUp, FiAward, FiCheckCircle } from 'react-icons/fi';
import api, { errMsg } from '../api';
import { FullPageLoading } from '../components/Loading';
import PageHeader from '../components/PageHeader';
import { ResultBar, StatusPill } from '../components/KpiBits';
import { fmtDate, fmtNum, formatCriterion } from '../utils/kpi';

const OK = '#10b981';
const BAD = '#f43f5e';
const NA = '#cbd5e1';

function KpiDetailPage() {
    const { slug, id } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        setData(null);
        setError(null);
        api.get(`/kpis/${id}/detail`)
            .then(res => setData(res.data))
            .catch(err => setError(errMsg(err, 'โหลดรายละเอียดไม่สำเร็จ')));
    }, [id]);

    if (error) return <div className="page"><Alert variant="danger">{error}</Alert></div>;
    if (!data) return <FullPageLoading />;

    const { kpi, value, year } = data;
    if (kpi.is_header || !value) {
        return <div className="page"><Alert variant="info">"{kpi.name}" เป็นหัวข้อ ไม่มีข้อมูลรายละเอียด</Alert></div>;
    }

    const unit = kpi.unit_label || '';
    const isPercent = Number(kpi.multiplier) === 100;
    const summaryUnit = value.hoscode ? value.units.find(u => u.hoscode === value.hoscode) : null;
    const summaryName = kpi.summary_scope === 'all'
        ? 'รวมทุกหน่วยบริการ'
        : (summaryUnit ? summaryUnit.name : `หน่วยบริการ ${value.hoscode}`);

    const pct = Math.max(0, Math.min(100, Number(value.percent) || 0));
    const mainColor = !value.has_data ? NA : (value.pass ? OK : BAD);
    const pieData = [{ v: pct, c: mainColor }, { v: Math.max(0, 100 - pct), c: '#eef2f6' }];

    const barData = value.units.map(u => ({ name: u.short_name, value: u.percent, pass: u.pass, has: u.target > 0 }));
    const maxVal = Math.max(Number(kpi.criterion) || 0, ...barData.map(b => b.value), 0);
    const yMax = isPercent && maxVal <= 100 ? 100 : Math.ceil(maxVal * 1.15) || 10;
    const barMax = isPercent ? 100 : yMax;
    const unitsWithData = value.units.filter(u => u.target > 0);
    const unitsPassed = unitsWithData.filter(u => u.pass).length;

    return (
        <div className="page">
            <Link to={`/kpi/${slug}`} className="d-inline-flex align-items-center gap-1 mb-2 small fw-semibold">
                <FiArrowLeft /> กลับไป{kpi.group_name}
            </Link>
            <PageHeader
                title={`${kpi.display_index ? kpi.display_index + '. ' : ''}${kpi.name}`}
                sub={`${kpi.group_name} · ปีงบประมาณ ${year}${kpi.last_sync ? ` · ซิงค์ล่าสุด ${fmtDate(kpi.last_sync.synced_at)} โดย ${kpi.last_sync.synced_by || '-'}` : ''}`}
            >
                {kpi.link && (
                    <a href={kpi.link} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary btn-icon">
                        <FiExternalLink /> แหล่งที่มา
                    </a>
                )}
            </PageHeader>

            <div className="stat-grid">
                <div className="stat">
                    <div className="stat-ic tone-teal"><FiTarget size={24} /></div>
                    <div><small>เกณฑ์</small><b>{formatCriterion(kpi)}</b><em>{isPercent ? 'ร้อยละ' : `ต่อ ${Number(kpi.multiplier).toLocaleString()}`}</em></div>
                </div>
                <div className="stat">
                    <div className="stat-ic tone-blue"><FiTrendingUp size={24} /></div>
                    <div><small>เป้าหมาย / ผลงาน</small><b>{fmtNum(value.result)}</b><em>จากเป้าหมาย {fmtNum(value.target)}</em></div>
                </div>
                <div className="stat">
                    <div className={`stat-ic ${!value.has_data ? 'tone-blue' : value.pass ? 'tone-green' : 'tone-red'}`}><FiAward size={24} /></div>
                    <div>
                        <small>ผลลัพธ์</small>
                        <b style={{ color: value.has_data ? (value.pass ? 'var(--ok-text)' : 'var(--bad-text)') : undefined }}>
                            {value.has_data ? `${fmtNum(value.percent)}${unit}` : '-'}
                        </b>
                        <StatusPill pass={value.pass} hasData={value.has_data} />
                    </div>
                </div>
                <div className="stat">
                    <div className="stat-ic tone-amber"><FiCheckCircle size={24} /></div>
                    <div><small>หน่วยบริการที่ผ่านเกณฑ์</small><b>{unitsPassed}/{unitsWithData.length}</b><em>หน่วยที่มีข้อมูล</em></div>
                </div>
            </div>

            <Row className="g-3 mb-3">
                <Col lg={4}>
                    <div className="panel h-100">
                        <div className="panel-head"><h3>ผลสรุป</h3></div>
                        <div className="panel-body text-center">
                            <div style={{ position: 'relative', height: 220 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} dataKey="v" innerRadius={70} outerRadius={95} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
                                            {pieData.map((d, i) => <Cell key={i} fill={d.c} />)}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                                    <div>
                                        <div style={{ fontSize: 30, fontWeight: 700, color: mainColor === NA ? 'var(--muted)' : mainColor }}>
                                            {value.has_data ? `${fmtNum(value.percent)}${unit}` : '-'}
                                        </div>
                                        <small className="text-muted">เกณฑ์ {formatCriterion(kpi)}</small>
                                    </div>
                                </div>
                            </div>
                            <div className="fw-semibold mt-2">{summaryName}</div>
                            <small className="text-muted">เป้าหมาย {fmtNum(value.target)} · ผลงาน {fmtNum(value.result)}</small>
                        </div>
                    </div>
                </Col>
                <Col lg={8}>
                    <div className="panel h-100">
                        <div className="panel-head"><h3>ผลลัพธ์รายหน่วยบริการ</h3></div>
                        <div className="panel-body">
                            <ResponsiveContainer width="100%" height={330}>
                                <BarChart data={barData} margin={{ bottom: 60, top: 24, left: 0, right: 70 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f6" />
                                    <XAxis dataKey="name" angle={-25} textAnchor="end" height={60} interval={0} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, yMax]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(val) => [`${Number(val).toFixed(2)}${unit}`, 'ผลลัพธ์']} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={38}>
                                        {barData.map((b, i) => <Cell key={i} fill={!b.has ? NA : b.pass === false ? BAD : OK} />)}
                                        <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: '#334155' }} formatter={(val) => (val ? Number(val).toFixed(1) : '')} />
                                    </Bar>
                                    {kpi.criterion !== null && (
                                        <ReferenceLine
                                            y={Number(kpi.criterion)}
                                            stroke="#f59e0b"
                                            strokeDasharray="5 4"
                                            label={{ value: `เกณฑ์ ${formatCriterion(kpi)}`, position: 'right', fill: '#b45309', fontSize: 12 }}
                                        />
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </Col>
            </Row>

            <div className="panel">
                <div className="panel-head"><h3>ข้อมูลรายหน่วยบริการ</h3></div>
                <Table hover responsive className="table-modern">
                    <thead>
                        <tr>
                            <th style={{ width: 110 }}>รหัส</th>
                            <th>หน่วยบริการ</th>
                            <th className="num">เป้าหมาย</th>
                            <th className="num">ผลงาน</th>
                            <th style={{ minWidth: 200 }}>ผลลัพธ์</th>
                            <th className="text-center">สถานะ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {value.units.map(u => (
                            <tr key={u.hoscode}>
                                <td className="muted">{u.hoscode}</td>
                                <td>
                                    {u.name}
                                    {u.manual && <span className="tag">กรอกเอง</span>}
                                    {u.hoscode === value.hoscode && kpi.summary_scope !== 'all' && <span className="tag" style={{ background: 'var(--brand-100)', color: 'var(--brand-600)' }}>หน่วยสรุปผล</span>}
                                </td>
                                <td className="num">{fmtNum(u.target)}</td>
                                <td className="num">{fmtNum(u.result)}</td>
                                <td><ResultBar value={u.percent} unit={unit} pass={u.pass} hasData={u.target > 0} max={barMax} /></td>
                                <td className="text-center"><StatusPill pass={u.pass} hasData={u.target > 0} /></td>
                            </tr>
                        ))}
                        <tr className="row-total">
                            <td></td>
                            <td>รวมทั้งสิ้น</td>
                            <td className="num">{fmtNum(value.total.target)}</td>
                            <td className="num">{fmtNum(value.total.result)}</td>
                            <td colSpan={2}>{value.total.target > 0 ? `${fmtNum(value.total.percent)}${unit}` : '-'}</td>
                        </tr>
                    </tbody>
                </Table>
            </div>
        </div>
    );
}

export default KpiDetailPage;
