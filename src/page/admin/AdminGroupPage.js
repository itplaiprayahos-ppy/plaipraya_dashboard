import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, ButtonGroup, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import api, { errMsg } from '../../api';
import { useAppData } from '../../context/AppDataContext';
import { FullPageLoading } from '../../components/Loading';
import { ICON_OPTIONS } from '../../utils/kpi';

const TH = { verticalAlign: 'middle' };
const emptyGroup = { slug: '', name: '', icon: 'chart-bar', color1: '#0575e6', color2: '#021b79', show_on_home: true, active: true };

function AdminGroupPage() {
    const { reload: reloadAppData } = useAppData();
    const [groups, setGroups] = useState(null);
    const [editing, setEditing] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/groups', { params: { all: 1 } });
            setGroups(res.data);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: errMsg(err) });
            setGroups([]);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const move = async (i, dir) => {
        const list = [...groups];
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        setGroups(list);
        try {
            await api.post('/groups/reorder', { ids: list.map(g => g.id) });
            reloadAppData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'เรียงลำดับไม่สำเร็จ', text: errMsg(err) });
            load();
        }
    };

    const save = async () => {
        try {
            if (editing.id) await api.put(`/groups/${editing.id}`, editing);
            else await api.post('/groups', editing);
            setEditing(null);
            load();
            reloadAppData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errMsg(err) });
        }
    };

    const remove = async (g) => {
        const r = await Swal.fire({
            icon: 'warning', title: `ลบกลุ่ม "${g.name}"?`,
            html: `ตัวชี้วัดในกลุ่มนี้ <b>${g.kpi_count}</b> รายการจะถูกลบไปด้วย<br/>(ถ้าแค่อยากซ่อน ให้ปิด "แสดงผล" แทน)`,
            showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc3545',
        });
        if (!r.isConfirmed) return;
        try {
            await api.delete(`/groups/${g.id}`);
            load();
            reloadAppData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: errMsg(err) });
        }
    };

    if (!groups) return <FullPageLoading />;
    const set = (f, v) => setEditing({ ...editing, [f]: v });

    return (
        <div className="page">
            <Row className="align-items-center my-3">
                <Col><h1 className="page-title">กลุ่มตัวชี้วัด</h1></Col>
                <Col xs="auto"><Button variant="success" onClick={() => setEditing({ ...emptyGroup })}><i className="fa fa-plus me-1" /> เพิ่มกลุ่ม</Button></Col>
            </Row>
            <p className="text-muted">แต่ละกลุ่มจะมีเมนูใน Sidebar และหน้าแสดงผลของตัวเองที่ /kpi/&lt;รหัสกลุ่ม&gt; อัตโนมัติ</p>

            <div className="panel"><Table hover responsive className="table-modern">
                <thead>
                    <tr>
                        <th style={{ ...TH, width: 90 }} className="text-center">เรียง</th>
                        <th style={TH}>ชื่อกลุ่ม</th>
                        <th style={TH}>รหัส (URL)</th>
                        <th style={TH} className="text-center">ตัวชี้วัด</th>
                        <th style={TH} className="text-center">สถานะ</th>
                        <th style={{ ...TH, width: 170 }} className="text-center">จัดการ</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">ยังไม่มีกลุ่ม</td></tr>}
                    {groups.map((g, i) => (
                        <tr key={g.id}>
                            <td className="text-center">
                                <ButtonGroup size="sm">
                                    <Button variant="outline-secondary" disabled={i === 0} onClick={() => move(i, -1)}>▲</Button>
                                    <Button variant="outline-secondary" disabled={i === groups.length - 1} onClick={() => move(i, 1)}>▼</Button>
                                </ButtonGroup>
                            </td>
                            <td>
                                <span className="d-inline-flex align-items-center justify-content-center me-2 rounded"
                                    style={{ width: 30, height: 30, color: '#fff', background: `linear-gradient(135deg, ${g.color1}, ${g.color2})` }}>
                                    <i className={`fa fa-${g.icon}`} />
                                </span>
                                {g.name}
                            </td>
                            <td><code>{g.slug}</code></td>
                            <td className="text-center"><Link to={`/admin/kpis?group=${g.id}`}>{g.kpi_count}</Link></td>
                            <td className="text-center">
                                {g.active ? <Badge bg="success">แสดง</Badge> : <Badge bg="secondary">ซ่อน</Badge>}
                                {g.show_on_home && <Badge bg="info" className="ms-1">หน้าแรก</Badge>}
                            </td>
                            <td className="text-center text-nowrap">
                                <Button size="sm" variant="outline-primary" className="me-1" onClick={() => setEditing({ ...g })}><i className="fa fa-edit" /></Button>
                                <Button size="sm" variant="outline-secondary" className="me-1" as={Link} to={`/kpi/${g.slug}`} title="ดูหน้าแสดงผล"><i className="fa fa-eye" /></Button>
                                <Button size="sm" variant="outline-danger" onClick={() => remove(g)}><i className="fa fa-trash" /></Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table></div>

            <Modal show={!!editing} onHide={() => setEditing(null)} centered>
                <Modal.Header closeButton><Modal.Title>{editing && editing.id ? 'แก้ไขกลุ่ม' : 'เพิ่มกลุ่ม'}</Modal.Title></Modal.Header>
                <Modal.Body>
                    {editing && (
                        <Form>
                            <Form.Group className="mb-3">
                                <Form.Label>ชื่อกลุ่ม</Form.Label>
                                <Form.Control value={editing.name} placeholder="เช่น ตัวชี้วัด QOF" onChange={e => set('name', e.target.value)} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>รหัสกลุ่ม (ใช้ใน URL)</Form.Label>
                                <Form.Control value={editing.slug} placeholder="เช่น qof" onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
                                <Form.Text>a-z, 0-9, - เท่านั้น → หน้า /kpi/{editing.slug || '...'}</Form.Text>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>ไอคอน</Form.Label>
                                <div className="d-flex flex-wrap gap-1">
                                    {ICON_OPTIONS.map(ic => (
                                        <Button key={ic} size="sm" variant={editing.icon === ic ? 'primary' : 'outline-secondary'} onClick={() => set('icon', ic)} title={ic}>
                                            <i className={`fa fa-${ic}`} />
                                        </Button>
                                    ))}
                                </div>
                            </Form.Group>
                            <Row className="mb-3">
                                <Col><Form.Label>สีเริ่ม</Form.Label><Form.Control type="color" value={editing.color1} onChange={e => set('color1', e.target.value)} /></Col>
                                <Col><Form.Label>สีปลาย</Form.Label><Form.Control type="color" value={editing.color2} onChange={e => set('color2', e.target.value)} /></Col>
                                <Col xs={12} className="mt-2">
                                    <div className="rounded p-3 text-white" style={{ background: `linear-gradient(135deg, ${editing.color1}, ${editing.color2})` }}>
                                        <i className={`fa fa-${editing.icon} me-2`} />{editing.name || 'ตัวอย่าง'}
                                    </div>
                                </Col>
                            </Row>
                            <Form.Check type="switch" id="g-active" label="แสดงผล (เมนูและหน้าเว็บ)" checked={editing.active} onChange={e => set('active', e.target.checked)} />
                            <Form.Check type="switch" id="g-home" label="แสดงในหน้าแรก" checked={editing.show_on_home} onChange={e => set('show_on_home', e.target.checked)} />
                        </Form>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setEditing(null)}>ยกเลิก</Button>
                    <Button variant="success" onClick={save}>บันทึก</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default AdminGroupPage;
