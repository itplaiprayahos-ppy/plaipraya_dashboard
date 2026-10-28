import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Col, Container, Form, Modal, OverlayTrigger, Row, Spinner, Table, Tooltip } from 'react-bootstrap';
import { IoReload } from 'react-icons/io5';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import StatCards from '../components/StatCards';
import { FullPageLoading, OverlayLoading } from '../components/Loading';
import { fmtDate, fmtNum, formatCriterion, passColor } from '../utils/kpi';

const TH = { backgroundColor: '#0d9488', color: '#fff', textAlign: 'center', verticalAlign: 'middle' };
const TD = { textAlign: 'center', verticalAlign: 'middle' };

// หน้าแสดงตัวชี้วัดของกลุ่ม (ใช้หน้าเดียวกันทุกกลุ่ม: MOU, กระทรวง, ตรวจราชการ, ...)
function KpiGroupPage() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth();
    const { year: selectedYear } = useAppData();

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);

    const [selected, setSelected] = useState(null);
    const [unitValues, setUnitValues] = useState([]);
    const [form, setForm] = useState({});
    const [loadingValues, setLoadingValues] = useState(false);

    const load = useCallback(async (silent = false) => {
        if (!selectedYear) return;
        if (!silent) setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/groups/${slug}/kpis`, { params: { year: selectedYear } });
            setData(res.data);
        } catch (err) {
            setError(errMsg(err, 'โหลดข้อมูลตัวชี้วัดไม่สำเร็จ'));
        } finally {
            setLoading(false);
        }
    }, [slug, selectedYear]);

    useEffect(() => { load(); }, [load]);

    const needLogin = async () => {
        const r = await Swal.fire({
            icon: 'warning', title: 'ยังไม่ได้เข้าสู่ระบบ', text: 'กรุณาเข้าสู่ระบบก่อน',
            confirmButtonText: 'ไปที่หน้าเข้าสู่ระบบ', showCancelButton: true, cancelButtonText: 'ยกเลิก',
        });
        if (r.isConfirmed) navigate('/login');
    };

    const openModal = async (kpi) => {
        setSelected(kpi);
        setUnitValues([]);
        setForm({});
        if (kpi.allow_manual && isAdmin) {
            setLoadingValues(true);
            try {
                const res = await api.get(`/kpis/${kpi.id}/values`);
                setUnitValues(res.data.units);
                const f = {};
                res.data.units.forEach(u => {
                    f[u.hoscode] = {
                        target: u.manual_target ?? '',
                        result: u.manual_result ?? '',
                    };
                });
                setForm(f);
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: errMsg(err) });
            } finally {
                setLoadingValues(false);
            }
        }
    };

    const closeModal = () => setSelected(null);

    const handleSync = async () => {
        if (!user) return needLogin();
        setBusy(true);
        try {
            const res = await api.post(`/kpis/${selected.id}/sync`);
            const count = res.data.results.reduce((a, r) => a + r.count, 0);
            setBusy(false);
            closeModal();
            await Swal.fire({ icon: 'success', title: 'Sync สำเร็จ', text: `นำเข้าข้อมูล ${count.toLocaleString()} แถว`, confirmButtonText: 'ตกลง' });
            load(true);
        } catch (err) {
            setBusy(false);
            if (err.response && err.response.status === 401) return needLogin();
            Swal.fire({ icon: 'error', title: 'Sync ล้มเหลว', text: errMsg(err, 'ไม่สามารถซิงค์ข้อมูลได้ กรุณาลองใหม่') });
        }
    };

    const handleChange = (hoscode, field, value) => {
        setForm(prev => ({ ...prev, [hoscode]: { ...prev[hoscode], [field]: value } }));
    };

    const handleSave = async () => {
        const confirm = await Swal.fire({
            icon: 'question', title: 'ยืนยัน', text: 'บันทึกข้อมูลใช่หรือไม่',
            showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#198754',
        });
        if (!confirm.isConfirmed) return;
        setBusy(true);
        try {
            const values = Object.entries(form).map(([hospcode, v]) => ({ hospcode, target: v.target, result: v.result }));
            await api.put(`/kpis/${selected.id}/values`, { values });
            setBusy(false);
            closeModal();
            await Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', confirmButtonText: 'ตกลง' });
            load(true);
        } catch (err) {
            setBusy(false);
            if (err.response && err.response.status === 401) return needLogin();
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errMsg(err) });
        }
    };

    if (loading) return <FullPageLoading />;
    if (error) {
        return <Container className="py-5"><Alert variant="danger">{error}</Alert></Container>;
    }

    const { group, kpis, year } = data;

    return (
        <Container fluid className="pb-5" style={{ backgroundColor: '#f8f9fa', padding: '25px' }}>
            <OverlayLoading show={busy} />

            <Row className="align-items-center">
                <Col>
                    <h2 className="text-start my-3" style={{ fontWeight: 700, color: '#2c3e50' }}>{group.name}</h2>
                </Col>
                <Col xs="auto" className="text-muted">ปีงบประมาณ {year}</Col>
                {isAdmin && (
                    <Col xs="auto">
                        <Button variant="outline-secondary" size="sm" onClick={() => navigate(`/admin/kpis?group=${group.id}`)}>
                            <i className="fa fa-edit me-1" /> จัดการตัวชี้วัดกลุ่มนี้
                        </Button>
                    </Col>
                )}
            </Row>

            <StatCards kpis={kpis} />

            <Row className="mt-5">
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th style={TH}>ลำดับ</th>
                            <th style={TH}>ตัวชี้วัด</th>
                            <th style={TH}>เกณฑ์</th>
                            <th style={TH}>เป้าหมาย</th>
                            <th style={TH}>ผลงาน</th>
                            <th style={TH}>ผลลัพธ์</th>
                            <th style={TH}>อ้างอิง</th>
                            {isAdmin && <th style={TH}></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {kpis.length === 0 && (
                            <tr><td colSpan={isAdmin ? 8 : 7} className="text-center text-muted py-4">ยังไม่มีตัวชี้วัดในกลุ่มนี้ของปีงบประมาณ {year}</td></tr>
                        )}
                        {kpis.map(k => k.is_header ? (
                            <tr key={k.id}>
                                <td style={TD}>{k.display_index}</td>
                                <td colSpan={isAdmin ? 7 : 6} style={{ verticalAlign: 'middle', fontWeight: 600 }}>{k.name}</td>
                            </tr>
                        ) : (
                            <tr key={k.id}>
                                <td style={TD}>{k.display_index}</td>
                                <OverlayTrigger
                                    placement="top"
                                    delay={{ show: 600, hide: 200 }}
                                    overlay={
                                        <Tooltip>
                                            {k.last_sync
                                                ? `ซิงค์ล่าสุด: ${fmtDate(k.last_sync.synced_at)} โดย ${k.last_sync.synced_by || '-'}`
                                                : (k.has_sources ? 'ยังไม่เคยซิงค์' : 'ข้อมูลกรอกเอง / ไม่มีแหล่งข้อมูล HDC')}
                                        </Tooltip>
                                    }
                                >
                                    <td style={{ textAlign: 'start', verticalAlign: 'middle' }}>
                                        <Link to={`/kpi/${group.slug}/detail/${k.id}`}>{k.name}</Link>
                                    </td>
                                </OverlayTrigger>
                                <td style={TD}>{formatCriterion(k)}</td>
                                <td style={TD}>{fmtNum(k.value.target)}</td>
                                <td style={TD}>{fmtNum(k.value.result)}</td>
                                <td style={{ ...TD, fontWeight: 700, backgroundColor: passColor(k.value.pass, k.value.has_data) }}>
                                    {k.value.has_data ? `${fmtNum(k.value.percent)}${k.unit_label || ''}` : '-'}
                                </td>
                                <td style={TD}>
                                    {k.link ? <a href={k.link} target="_blank" rel="noopener noreferrer">ที่มา</a> : '-'}
                                </td>
                                {isAdmin && <td style={TD}>
                                    {(k.has_sources || k.allow_manual) && (
                                        <button
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                                            onClick={() => openModal(k)}
                                            title="ซิงค์ / กรอกข้อมูล"
                                        >
                                            <BsThreeDotsVertical size={18} />
                                        </button>
                                    )}
                                </td>}
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Row>

            <Modal show={!!selected} onHide={closeModal} size="xl" centered scrollable>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '1.1rem' }}>{selected && selected.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selected && (
                        <div className="d-flex flex-column gap-3">
                            {selected.has_sources && (
                                <div className="d-flex align-items-center flex-wrap gap-2">
                                    <p className="mb-0 fw-bold">ซิงค์ข้อมูลจาก HDC:</p>
                                    <Button variant="outline-success" onClick={handleSync}>
                                        ซิงค์ข้อมูล <IoReload className="ms-2" />
                                    </Button>
                                    {selected.last_sync && (
                                        <small className="text-muted">
                                            ล่าสุด {fmtDate(selected.last_sync.synced_at)} โดย {selected.last_sync.synced_by || '-'}
                                        </small>
                                    )}
                                </div>
                            )}

                            {selected.allow_manual && isAdmin && (
                                <div className="mt-2">
                                    <p className="fw-bold mb-1">กรอกข้อมูลรายหน่วยบริการ</p>
                                    <small className="text-muted d-block mb-3">
                                        เว้นว่าง = ใช้ค่าจาก HDC (ตัวเลขสีเทาในช่องคือค่าปัจจุบัน)
                                    </small>
                                    {loadingValues ? (
                                        <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
                                    ) : (
                                        <>
                                            <Row className="mb-2 d-none d-md-flex">
                                                <Col md={4}><b>หน่วยบริการ</b></Col>
                                                <Col md={4}><b>เป้าหมาย</b></Col>
                                                <Col md={4}><b>ผลงาน</b></Col>
                                            </Row>
                                            {unitValues.map(u => (
                                                <Row key={u.hoscode} className="align-items-center mb-2">
                                                    <Col xs={12} md={4} className="mb-1 mb-md-0">
                                                        {u.short_name} <small className="text-muted">({u.hoscode})</small>
                                                    </Col>
                                                    <Col xs={6} md={4}>
                                                        <Form.Control
                                                            inputMode="decimal"
                                                            placeholder={fmtNum(u.target)}
                                                            value={(form[u.hoscode] && form[u.hoscode].target) ?? ''}
                                                            onChange={e => handleChange(u.hoscode, 'target', e.target.value)}
                                                        />
                                                    </Col>
                                                    <Col xs={6} md={4}>
                                                        <Form.Control
                                                            inputMode="decimal"
                                                            placeholder={fmtNum(u.result)}
                                                            value={(form[u.hoscode] && form[u.hoscode].result) ?? ''}
                                                            onChange={e => handleChange(u.hoscode, 'result', e.target.value)}
                                                        />
                                                    </Col>
                                                </Row>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    {selected && selected.allow_manual && isAdmin && (
                        <Button variant="success" onClick={handleSave} disabled={loadingValues}>บันทึก</Button>
                    )}
                    <Button variant="secondary" onClick={closeModal}>ปิด</Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default KpiGroupPage;
