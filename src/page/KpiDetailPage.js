import { useEffect, useState } from 'react';
import { Alert, Badge, Col, Container, Row, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { PieChart } from '@mui/x-charts';
import {
    BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import Typography from '@mui/material/Typography';
import { Card } from '@mui/material';
import api, { errMsg } from '../api';
import { FullPageLoading } from '../components/Loading';
import { fmtDate, fmtNum, formatCriterion, passColor } from '../utils/kpi';

const TH = { backgroundColor: '#0d9488', color: '#fff', textAlign: 'center' };

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

    if (error) return <Container className="py-5"><Alert variant="danger">{error}</Alert></Container>;
    if (!data) return <FullPageLoading />;

    const { kpi, value, year } = data;
    if (kpi.is_header || !value) {
        return <Container className="py-5"><Alert variant="info">"{kpi.name}" เป็นหัวข้อ ไม่มีข้อมูลรายละเอียด</Alert></Container>;
    }

    const unit = kpi.unit_label || '';
    const isPercent = Number(kpi.multiplier) === 100;
    const summaryUnit = value.hoscode ? value.units.find(u => u.hoscode === value.hoscode) : null;
    const summaryName = kpi.summary_scope === 'all'
        ? 'รวมทุกหน่วยบริการ'
        : (summaryUnit ? summaryUnit.name : `หน่วยบริการ ${value.hoscode}`);

    const pct = Math.max(0, Math.min(100, Number(value.percent) || 0));
    const pieData = [
        { id: 0, label: 'ผลงาน', value: pct, color: value.pass ? '#4CAF50' : '#F44336' },
        { id: 1, label: 'คงเหลือ', value: Math.round((100 - pct) * 100) / 100, color: '#e0e0e0' },
    ];

    const barData = value.units.map(u => ({ name: u.short_name, value: u.percent, pass: u.pass }));
    const maxVal = Math.max(Number(kpi.criterion) || 0, ...barData.map(b => b.value), 0);
    const yMax = isPercent && maxVal <= 100 ? 100 : Math.ceil(maxVal * 1.15) || 10;

    return (
        <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <small><Link to={`/kpi/${slug}`}>← กลับไป{kpi.group_name}</Link></small>
                    <h3 className="text-primary fw-bold mt-2">รายละเอียดตัวชี้วัด</h3>
                    <p className="mb-1"><strong>ตัวชี้วัด:</strong> {kpi.display_index ? `${kpi.display_index}. ` : ''}{kpi.name}</p>
                    <p className="mb-1">
                        <strong>เกณฑ์:</strong> {formatCriterion(kpi)}
                        {' · '}<strong>ปีงบประมาณ:</strong> {year}
                        {' · '}<strong>ผลสรุป:</strong>{' '}
                        {value.has_data
                            ? <Badge bg={value.pass ? 'success' : 'danger'}>{fmtNum(value.percent)}{unit} {value.pass ? 'ผ่าน' : 'ไม่ผ่าน'}</Badge>
                            : <Badge bg="secondary">ยังไม่มีข้อมูล</Badge>}
                    </p>
                    {kpi.last_sync && <small className="text-muted">ซิงค์ล่าสุด {fmtDate(kpi.last_sync.synced_at)} โดย {kpi.last_sync.synced_by || '-'}</small>}
                    {kpi.link && <div><small><a href={kpi.link} target="_blank" rel="noopener noreferrer">แหล่งที่มา</a></small></div>}
                </Col>
            </Row>

            <Row className="g-4">
                <Col lg={4}>
                    <Card elevation={3} className="p-4 text-center" style={{ minHeight: 450 }}>
                        {isPercent ? (
                            <PieChart
                                series={[{
                                    data: pieData,
                                    innerRadius: 50,
                                    valueFormatter: (item) => `${item.value}%`,
                                }]}
                                height={250}
                                width={250}
                                hideLegend
                            />
                        ) : (
                            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '3rem', fontWeight: 700, color: value.pass ? '#4CAF50' : '#F44336' }}>
                                    {fmtNum(value.percent)}
                                </span>
                            </div>
                        )}
                        <Typography variant="subtitle1" className="mt-3">{summaryName}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            เป้าหมาย {fmtNum(value.target)} · ผลงาน {fmtNum(value.result)}
                        </Typography>
                    </Card>
                </Col>

                <Col lg={8}>
                    <Card elevation={3} className="p-4" style={{ minHeight: 450 }}>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={barData} margin={{ bottom: 80, top: 30, left: 10, right: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-25} textAnchor="end" height={60} interval={0} />
                                <YAxis domain={[0, yMax]} />
                                <Tooltip formatter={(val) => `${Number(val).toFixed(2)}${unit}`} />
                                <Bar dataKey="value" name="ผลลัพธ์">
                                    {barData.map((b, i) => <Cell key={i} fill={b.pass === false ? '#F44336' : '#4CAF50'} />)}
                                    <LabelList dataKey="value" position="top" formatter={(val) => (val ? `${Number(val).toFixed(2)}` : '')} />
                                </Bar>
                                {kpi.criterion !== null && (
                                    <ReferenceLine
                                        y={Number(kpi.criterion)}
                                        stroke="red"
                                        strokeDasharray="4 4"
                                        label={{ value: `เกณฑ์ ${formatCriterion(kpi)}`, position: 'right', fill: 'red', fontSize: 12 }}
                                    />
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
            </Row>

            <Row className="mt-5">
                <Card elevation={3} className="p-3">
                    <Table striped bordered hover responsive className="mb-0">
                        <thead>
                            <tr>
                                <th style={TH}>รหัสหน่วยบริการ</th>
                                <th style={{ ...TH, textAlign: 'left' }}>ชื่อหน่วยบริการ</th>
                                <th style={TH}>เป้าหมาย</th>
                                <th style={TH}>ผลงาน</th>
                                <th style={TH}>ผลลัพธ์</th>
                            </tr>
                        </thead>
                        <tbody>
                            {value.units.map(u => (
                                <tr key={u.hoscode}>
                                    <td className="text-center">{u.hoscode}</td>
                                    <td>
                                        {u.name}
                                        {u.manual && <Badge bg="info" className="ms-2" title="ค่ากรอกเอง">กรอกเอง</Badge>}
                                    </td>
                                    <td className="text-center">{fmtNum(u.target)}</td>
                                    <td className="text-center">{fmtNum(u.result)}</td>
                                    <td className="text-center fw-bold" style={{ backgroundColor: passColor(u.pass, u.target > 0) }}>
                                        {u.target > 0 ? `${fmtNum(u.percent)}${unit}` : '-'}
                                    </td>
                                </tr>
                            ))}
                            <tr className="fw-bold">
                                <td></td>
                                <td>รวมทั้งสิ้น</td>
                                <td className="text-center">{fmtNum(value.total.target)}</td>
                                <td className="text-center">{fmtNum(value.total.result)}</td>
                                <td className="text-center">{value.total.target > 0 ? `${fmtNum(value.total.percent)}${unit}` : '-'}</td>
                            </tr>
                        </tbody>
                    </Table>
                </Card>
            </Row>
        </Container>
    );
}

export default KpiDetailPage;
