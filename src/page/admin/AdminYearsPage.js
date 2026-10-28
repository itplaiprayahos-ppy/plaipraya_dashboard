import { useState } from 'react';
import { Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api, { errMsg } from '../../api';
import { useAppData } from '../../context/AppDataContext';
import { OverlayLoading } from '../../components/Loading';
import { fmtDate } from '../../utils/kpi';

const TH = { verticalAlign: 'middle' };

// จัดการปีงบประมาณ: แต่ละปีมีชุดตัวชี้วัดของตัวเอง
function AdminYearsPage() {
    const navigate = useNavigate();
    const { years, settings, year: selectedYear, setYear, reload } = useAppData();
    const [busy, setBusy] = useState(false);
    const latest = years.length ? years[0].year : '';
    const [form, setForm] = useState({ year: '', copy_from: '', note: '' });

    const suggestedYear = latest ? String(Number(latest) + 1) : '';

    const create = async () => {
        const y = (form.year || suggestedYear).trim();
        if (!/^\d{4}$/.test(y)) {
            Swal.fire({ icon: 'warning', title: 'กรุณากรอกปีงบประมาณ 4 หลัก เช่น 2570' });
            return;
        }
        const copyText = form.copy_from
            ? `คัดลอกตัวชี้วัดทั้งหมด (พร้อมเกณฑ์และแหล่งข้อมูล HDC) จากปี ${form.copy_from} — แก้ไขภายหลังได้`
            : 'เริ่มจากว่าง แล้วตั้งค่าตัวชี้วัดใหม่ทั้งหมด';
        const r = await Swal.fire({
            icon: 'question', title: `สร้างปีงบประมาณ ${y}?`, text: copyText,
            showCancelButton: true, confirmButtonText: 'สร้าง', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#198754',
        });
        if (!r.isConfirmed) return;
        setBusy(true);
        try {
            const res = await api.post('/admin/years', { year: y, copy_from: form.copy_from || null, note: form.note });
            await reload();
            setYear(y);
            setForm({ year: '', copy_from: '', note: '' });
            setBusy(false);
            const go = await Swal.fire({
                icon: 'success', title: `สร้างปีงบประมาณ ${y} แล้ว`,
                text: res.data.copied ? `คัดลอกตัวชี้วัด ${res.data.copied} รายการ` : 'ยังไม่มีตัวชี้วัด',
                showCancelButton: true, confirmButtonText: 'ไปตั้งค่าตัวชี้วัด', cancelButtonText: 'ปิด',
            });
            if (go.isConfirmed) navigate('/admin/kpis');
        } catch (err) {
            setBusy(false);
            Swal.fire({ icon: 'error', title: 'สร้างไม่สำเร็จ', text: errMsg(err) });
        }
    };

    const makeDefault = async (y) => {
        try {
            await api.put('/settings', { b_year: y });
            await reload();
            Swal.fire({ icon: 'success', title: `ตั้ง ${y} เป็นปีเริ่มต้นแล้ว`, timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: errMsg(err) });
        }
    };

    const remove = async (y) => {
        const r = await Swal.fire({
            icon: 'warning', title: `ลบปีงบประมาณ ${y.year}?`,
            html: `ตัวชี้วัดของปีนี้ <b>${y.kpi_count}</b> รายการ และค่าที่กรอกเองของปีนี้จะถูกลบ<br/>(ข้อมูลดิบที่ซิงค์จาก HDC ยังเก็บไว้)`,
            input: 'text', inputPlaceholder: `พิมพ์ ${y.year} เพื่อยืนยัน`,
            showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc3545',
            preConfirm: (v) => (v === y.year ? true : (Swal.showValidationMessage(`พิมพ์ ${y.year} ให้ตรง`), false)),
        });
        if (!r.isConfirmed) return;
        setBusy(true);
        try {
            await api.delete(`/admin/years/${y.year}`);
            await reload();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: errMsg(err) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="page">
            <OverlayLoading show={busy} />
            <h1 className="page-title mb-3">ปีงบประมาณ</h1>
            <p className="text-muted">
                ตัวชี้วัดของแต่ละปีงบประมาณแยกกัน แก้ไขปีหนึ่งไม่กระทบอีกปี — ผู้ใช้เลือกปีที่จะดูได้ที่มุมบนขวาของทุกหน้า
            </p>

            <Card className="mb-4">
                <Card.Header className="fw-bold bg-white">เพิ่มปีงบประมาณใหม่</Card.Header>
                <Card.Body>
                    <Row className="g-3 align-items-end">
                        <Col md={2}>
                            <Form.Label>ปีงบประมาณ</Form.Label>
                            <Form.Control
                                inputMode="numeric" maxLength={4} placeholder={suggestedYear || 'เช่น 2570'}
                                value={form.year} onChange={e => setForm({ ...form, year: e.target.value.replace(/\D/g, '') })}
                            />
                        </Col>
                        <Col md={4}>
                            <Form.Label>ตัวชี้วัดเริ่มต้น</Form.Label>
                            <Form.Select value={form.copy_from} onChange={e => setForm({ ...form, copy_from: e.target.value })}>
                                <option value="">เริ่มจากว่าง (ตั้งค่าใหม่ทั้งหมด)</option>
                                {years.map(y => (
                                    <option key={y.year} value={y.year}>คัดลอกจากปี {y.year} ({y.kpi_count} ตัวชี้วัด)</option>
                                ))}
                            </Form.Select>
                        </Col>
                        <Col md={4}>
                            <Form.Label>หมายเหตุ</Form.Label>
                            <Form.Control value={form.note} placeholder="(ไม่บังคับ)" onChange={e => setForm({ ...form, note: e.target.value })} />
                        </Col>
                        <Col md={2} className="text-md-end">
                            <Button variant="success" onClick={create}><i className="fa fa-plus me-1" /> สร้างปี</Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <div className="panel"><Table hover responsive className="table-modern">
                <thead>
                    <tr>
                        <th style={TH}>ปีงบประมาณ</th>
                        <th style={TH} className="text-center">ตัวชี้วัด</th>
                        <th style={TH}>หมายเหตุ</th>
                        <th style={TH}>สร้างเมื่อ</th>
                        <th style={{ ...TH, width: 330 }} className="text-center">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    {years.map(y => {
                        const isDefault = y.year === settings.b_year;
                        return (
                            <tr key={y.year}>
                                <td className="fw-bold">
                                    {y.year}
                                    {isDefault && <Badge bg="success" className="ms-2">ปีเริ่มต้น</Badge>}
                                    {y.year === selectedYear && <Badge bg="info" className="ms-2">กำลังดู</Badge>}
                                </td>
                                <td className="text-center">{y.kpi_count}</td>
                                <td>{y.note}</td>
                                <td className="small">{fmtDate(y.created_at)}</td>
                                <td className="text-center text-nowrap">
                                    <Button size="sm" variant="outline-primary" className="me-1"
                                        onClick={() => { setYear(y.year); navigate('/admin/kpis'); }}>
                                        <i className="fa fa-edit me-1" />ตั้งค่าตัวชี้วัด
                                    </Button>
                                    <Button size="sm" variant="outline-success" className="me-1" disabled={isDefault} onClick={() => makeDefault(y.year)}>
                                        ตั้งเป็นปีเริ่มต้น
                                    </Button>
                                    <Button size="sm" variant="outline-danger" disabled={isDefault} onClick={() => remove(y)} title={isDefault ? 'ลบปีเริ่มต้นไม่ได้' : 'ลบ'}>
                                        <i className="fa fa-trash" />
                                    </Button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </Table></div>
        </div>
    );
}

export default AdminYearsPage;
