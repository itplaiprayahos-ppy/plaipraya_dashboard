import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, ButtonGroup, Card, Col, Container, Form, ListGroup, Modal, Row, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import api, { errMsg } from '../../api';
import { useAppData } from '../../context/AppDataContext';
import { FullPageLoading } from '../../components/Loading';

const TH = { backgroundColor: '#0d9488', color: '#fff', verticalAlign: 'middle' };

function AdminSettingsPage() {
    const { reload: reloadAppData, years } = useAppData();
    const [defs, setDefs] = useState([]);
    const [values, setValues] = useState(null);
    const [units, setUnits] = useState([]);
    const [editingUnit, setEditingUnit] = useState(null);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);

    const load = useCallback(async () => {
        try {
            const [s, u] = await Promise.all([api.get('/settings'), api.get('/units', { params: { all: 1 } })]);
            setDefs(s.data.defs);
            setValues(s.data.values);
            setUnits(u.data);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: errMsg(err) });
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const saveSettings = async () => {
        try {
            await api.put('/settings', values);
            reloadAppData();
            Swal.fire({ icon: 'success', title: 'บันทึกการตั้งค่าแล้ว', timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errMsg(err) });
        }
    };

    const moveUnit = async (i, dir) => {
        const list = [...units];
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        setUnits(list);
        try {
            await api.post('/units/reorder', { hoscodes: list.map(u => u.hoscode) });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'เรียงลำดับไม่สำเร็จ', text: errMsg(err) });
            load();
        }
    };

    const doSearch = async (q) => {
        try {
            const res = await api.get('/chospital/search', { params: { q } });
            setResults(res.data);
        } catch (err) {
            setResults([]);
        }
    };

    const openNewUnit = () => {
        setEditingUnit({ isNew: true, hoscode: '', name: '', short_name: '', active: true });
        setSearch('');
        doSearch('');
    };

    const saveUnit = async () => {
        try {
            if (editingUnit.isNew) await api.post('/units', editingUnit);
            else await api.put(`/units/${editingUnit.hoscode}`, editingUnit);
            setEditingUnit(null);
            load();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errMsg(err) });
        }
    };

    const removeUnit = async (u) => {
        const r = await Swal.fire({
            icon: 'warning', title: `ลบ ${u.name}?`, text: 'หน่วยนี้จะไม่แสดงในตารางรายละเอียดและฟอร์มกรอกข้อมูล',
            showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc3545',
        });
        if (!r.isConfirmed) return;
        try {
            await api.delete(`/units/${u.hoscode}`);
            load();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: errMsg(err) });
        }
    };

    if (!values) return <FullPageLoading />;

    return (
        <Container fluid className="pb-5" style={{ backgroundColor: '#f8f9fa', padding: 25 }}>
            <h2 className="my-3" style={{ fontWeight: 700, color: '#2c3e50' }}>ตั้งค่าระบบ</h2>

            <Card className="mb-4">
                <Card.Header className="fw-bold bg-white">ค่าทั่วไป</Card.Header>
                <Card.Body>
                    <Row className="g-3">
                        {defs.map(d => (
                            <Col md={d.key === 'hdc_api_url' || d.key === 'site_name' ? 6 : 3} key={d.key}>
                                <Form.Label>{d.label}</Form.Label>
                                {d.key === 'b_year' ? (
                                    <Form.Select value={values.b_year ?? ''} onChange={e => setValues({ ...values, b_year: e.target.value })}>
                                        {years.map(y => <option key={y.year} value={y.year}>{y.year}</option>)}
                                    </Form.Select>
                                ) : (
                                    <Form.Control value={values[d.key] ?? ''} onChange={e => setValues({ ...values, [d.key]: e.target.value })} />
                                )}
                            </Col>
                        ))}
                    </Row>
                    <small className="text-muted d-block mt-3">
                        ปีงบประมาณเริ่มต้น = ปีที่แสดงเมื่อผู้ใช้เปิดเว็บครั้งแรก (ผู้ใช้เปลี่ยนปีเองได้ที่มุมบนขวา) — เพิ่มปีใหม่ที่เมนู "ปีงบประมาณ"
                    </small>
                    <div className="text-end mt-3">
                        <Button variant="success" onClick={saveSettings}>บันทึกการตั้งค่า</Button>
                    </div>
                </Card.Body>
            </Card>

            <Card>
                <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                    <span className="fw-bold">หน่วยบริการ (แสดงในตารางรายละเอียดและฟอร์มกรอกข้อมูล)</span>
                    <Button size="sm" variant="success" onClick={openNewUnit}><i className="fa fa-plus me-1" /> เพิ่มหน่วยบริการ</Button>
                </Card.Header>
                <Card.Body>
                    <Table bordered hover responsive size="sm" className="mb-0">
                        <thead>
                            <tr>
                                <th style={{ ...TH, width: 90 }} className="text-center">เรียง</th>
                                <th style={TH}>รหัส</th>
                                <th style={TH}>ชื่อเต็ม</th>
                                <th style={TH}>ชื่อย่อ (แสดงในกราฟ)</th>
                                <th style={TH} className="text-center">สถานะ</th>
                                <th style={{ ...TH, width: 110 }} className="text-center">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {units.map((u, i) => (
                                <tr key={u.hoscode} style={{ opacity: u.active ? 1 : 0.5 }}>
                                    <td className="text-center">
                                        <ButtonGroup size="sm">
                                            <Button variant="outline-secondary" disabled={i === 0} onClick={() => moveUnit(i, -1)}>▲</Button>
                                            <Button variant="outline-secondary" disabled={i === units.length - 1} onClick={() => moveUnit(i, 1)}>▼</Button>
                                        </ButtonGroup>
                                    </td>
                                    <td>{u.hoscode}</td>
                                    <td>{u.name}</td>
                                    <td>{u.short_name}</td>
                                    <td className="text-center">{u.active ? <Badge bg="success">ใช้งาน</Badge> : <Badge bg="secondary">ปิด</Badge>}</td>
                                    <td className="text-center text-nowrap">
                                        <Button size="sm" variant="outline-primary" className="me-1" onClick={() => setEditingUnit({ ...u })}><i className="fa fa-edit" /></Button>
                                        <Button size="sm" variant="outline-danger" onClick={() => removeUnit(u)}><i className="fa fa-trash" /></Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            <Modal show={!!editingUnit} onHide={() => setEditingUnit(null)} centered size="lg">
                <Modal.Header closeButton><Modal.Title>{editingUnit && editingUnit.isNew ? 'เพิ่มหน่วยบริการ' : 'แก้ไขหน่วยบริการ'}</Modal.Title></Modal.Header>
                <Modal.Body>
                    {editingUnit && (
                        <>
                            {editingUnit.isNew && (
                                <div className="mb-3">
                                    <Form.Label>ค้นหาจากทะเบียนหน่วยบริการ (chospital)</Form.Label>
                                    <Form.Control
                                        placeholder="พิมพ์รหัสหรือชื่อ แล้วกด Enter (ว่าง = หน่วยในอำเภอที่ตั้งค่าไว้)"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(search); } }}
                                    />
                                    <ListGroup style={{ maxHeight: 200, overflowY: 'auto' }} className="mt-2">
                                        {results.map(r => (
                                            <ListGroup.Item key={r.hoscode} action
                                                disabled={units.some(u => u.hoscode === r.hoscode)}
                                                onClick={() => setEditingUnit({ ...editingUnit, hoscode: r.hoscode, name: r.hosname })}>
                                                <b>{r.hoscode}</b> {r.hosname} <small className="text-muted">{r.amp_name} {r.chw_name}</small>
                                                {units.some(u => u.hoscode === r.hoscode) && <Badge bg="secondary" className="ms-2">มีแล้ว</Badge>}
                                            </ListGroup.Item>
                                        ))}
                                    </ListGroup>
                                </div>
                            )}
                            <Row className="g-3">
                                <Col md={3}>
                                    <Form.Label>รหัส</Form.Label>
                                    <Form.Control value={editingUnit.hoscode} disabled={!editingUnit.isNew} onChange={e => setEditingUnit({ ...editingUnit, hoscode: e.target.value.trim() })} />
                                </Col>
                                <Col md={9}>
                                    <Form.Label>ชื่อเต็ม</Form.Label>
                                    <Form.Control value={editingUnit.name} onChange={e => setEditingUnit({ ...editingUnit, name: e.target.value })} />
                                </Col>
                                <Col md={6}>
                                    <Form.Label>ชื่อย่อ</Form.Label>
                                    <Form.Control value={editingUnit.short_name || ''} placeholder="เช่น รพสต.บ้านนา" onChange={e => setEditingUnit({ ...editingUnit, short_name: e.target.value })} />
                                </Col>
                                <Col md={6} className="d-flex align-items-end">
                                    <Form.Check type="switch" id="u-active" label="ใช้งาน" checked={editingUnit.active} onChange={e => setEditingUnit({ ...editingUnit, active: e.target.checked })} />
                                </Col>
                            </Row>
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setEditingUnit(null)}>ยกเลิก</Button>
                    <Button variant="success" onClick={saveUnit}>บันทึก</Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default AdminSettingsPage;
