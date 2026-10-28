import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, Form, Modal, OverlayTrigger, Row, Spinner, Table, Tooltip } from 'react-bootstrap';
import { FiExternalLink, FiMoreVertical, FiRefreshCw, FiSearch, FiSettings } from 'react-icons/fi';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import StatCards from '../components/StatCards';
import PageHeader from '../components/PageHeader';
import { ResultBar, StatusPill, kpiStatus } from '../components/KpiBits';
import { FullPageLoading, OverlayLoading } from '../components/Loading';
import { fmtDate, fmtNum, formatCriterion } from '../utils/kpi';

const TABS = [
    ['all', 'ทั้งหมด'],
    ['pass', 'ผ่าน'],
    ['fail', 'ไม่ผ่าน'],
    ['nodata', 'ยังไม่มีข้อมูล'],
];

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
    const [tab, setTab] = useState('all');
    const [q, setQ] = useState('');

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
            await Swal.fire({ icon: 'success', title: 'ซิงค์สำเร็จ', text: `นำเข้าข้อมูล ${count.toLocaleString()} แถว`, confirmButtonText: 'ตกลง' });
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
            showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก',
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

    // กรองตามแท็บ + คำค้น (เมื่อกรอง จะซ่อนแถวหัวข้อ)
    const kpisAll = data ? data.kpis : [];
    const filtered = useFilteredKpis(kpisAll, tab, q);

    if (loading) return <FullPageLoading />;
    if (error) {
        return <div className="page"><Alert variant="danger">{error}</Alert></div>;
    }

    const { group, kpis, year } = data;
    const counts = { all: 0, pass: 0, fail: 0, nodata: 0 };
    kpis.filter(k => !k.is_header).forEach(k => { counts.all++; counts[kpiStatus(k)]++; });
    const lastSync = kpis.reduce((a, k) => (k.last_sync && (!a || k.last_sync.synced_at > a) ? k.last_sync.synced_at : a), null);
    const cols = isAdmin ? 8 : 7;

    return (
        <div className="page">
            <OverlayLoading show={busy} />

            <PageHeader
                title={group.name}
                sub={`ปีงบประมาณ ${year}${lastSync ? ` · ซิงค์ข้อมูลล่าสุด ${fmtDate(lastSync)}` : ''}`}
            >
                {isAdmin && (
                    <>
                        <Button variant="outline-primary" className="btn-icon" onClick={() => navigate('/admin/hdc')}>
                            <FiRefreshCw /> ซิงค์ข้อมูล HDC
                        </Button>
                        <Button variant="primary" className="btn-icon" onClick={() => navigate(`/admin/kpis?group=${group.id}`)}>
                            <FiSettings /> จัดการตัวชี้วัด
                        </Button>
                    </>
                )}
            </PageHeader>

            <StatCards kpis={kpis} />

            <div className="panel">
                <div className="panel-head">
                    <div className="seg-tabs">
                        {TABS.map(([key, label]) => (
                            <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
                                {label}<span className="count">{counts[key]}</span>
                            </button>
                        ))}
                    </div>
                    <label className="search-box mb-0">
                        <FiSearch />
                        <input placeholder="ค้นหาตัวชี้วัด..." value={q} onChange={e => setQ(e.target.value)} />
                    </label>
                </div>
                <Table hover responsive className="table-modern">
                    <thead>
                        <tr>
                            <th className="text-center" style={{ width: 64 }}>ลำดับ</th>
                            <th>ตัวชี้วัด</th>
                            <th className="text-center">เกณฑ์</th>
                            <th className="num">เป้าหมาย</th>
                            <th className="num">ผลงาน</th>
                            <th style={{ minWidth: 190 }}>ผลลัพธ์</th>
                            <th className="text-center">สถานะ</th>
                            {isAdmin && <th style={{ width: 48 }}></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={cols} className="text-center text-muted py-5">
                                {kpis.length === 0 ? `ยังไม่มีตัวชี้วัดในกลุ่มนี้ของปีงบประมาณ ${year}` : 'ไม่พบตัวชี้วัดตามเงื่อนไข'}
                            </td></tr>
                        )}
                        {filtered.map(k => k.is_header ? (
                            <tr key={k.id} className="row-head">
                                <td className="text-center">{k.display_index}</td>
                                <td colSpan={cols - 1}>{k.name}</td>
                            </tr>
                        ) : (
                            <tr key={k.id}>
                                <td className="text-center muted">{k.display_index}</td>
                                <OverlayTrigger
                                    placement="top"
                                    delay={{ show: 600, hide: 150 }}
                                    overlay={
                                        <Tooltip>
                                            {k.last_sync
                                                ? `ซิงค์ล่าสุด: ${fmtDate(k.last_sync.synced_at)} โดย ${k.last_sync.synced_by || '-'}`
                                                : (k.has_sources ? 'ยังไม่เคยซิงค์' : 'ข้อมูลกรอกเอง / ไม่มีแหล่งข้อมูล HDC')}
                                        </Tooltip>
                                    }
                                >
                                    <td style={{ paddingLeft: k.display_index ? undefined : 34 }}>
                                        <Link to={`/kpi/${group.slug}/detail/${k.id}`} style={{ color: 'var(--text)' }}>{k.name}</Link>
                                        {k.allow_manual && !k.has_sources && <span className="tag">กรอกเอง</span>}
                                        {k.link && (
                                            <a href={k.link} target="_blank" rel="noopener noreferrer" className="ms-2 muted" title="แหล่งที่มา">
                                                <FiExternalLink size={13} />
                                            </a>
                                        )}
                                    </td>
                                </OverlayTrigger>
                                <td className="text-center muted text-nowrap">{formatCriterion(k)}</td>
                                <td className="num">{fmtNum(k.value.target)}</td>
                                <td className="num">{fmtNum(k.value.result)}</td>
                                <td>
                                    <ResultBar
                                        value={k.value.percent} unit={k.unit_label || ''} pass={k.value.pass}
                                        hasData={k.value.has_data} max={Number(k.multiplier) === 100 ? 100 : Math.max(k.value.percent, k.criterion || 0) * 1.2}
                                    />
                                </td>
                                <td className="text-center"><StatusPill pass={k.value.pass} hasData={k.value.has_data} /></td>
                                {isAdmin && (
                                    <td className="text-center">
                                        {(k.has_sources || k.allow_manual) && (
                                            <button className="row-action" onClick={() => openModal(k)} title="ซิงค์ / กรอกข้อมูล">
                                                <FiMoreVertical size={18} />
                                            </button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>

            <Modal show={!!selected} onHide={closeModal} size="xl" centered scrollable>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '1.05rem' }}>{selected && selected.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selected && (
                        <div className="d-flex flex-column gap-3">
                            {selected.has_sources && (
                                <div className="d-flex align-items-center flex-wrap gap-3 p-3 rounded" style={{ background: 'var(--surface-2)' }}>
                                    <div className="flex-grow-1">
                                        <div className="fw-semibold">ซิงค์ข้อมูลจาก HDC</div>
                                        <small className="text-muted">
                                            {selected.last_sync
                                                ? `ล่าสุด ${fmtDate(selected.last_sync.synced_at)} โดย ${selected.last_sync.synced_by || '-'}`
                                                : 'ยังไม่เคยซิงค์'}
                                        </small>
                                    </div>
                                    <Button variant="primary" className="btn-icon" onClick={handleSync}>
                                        <FiRefreshCw /> ซิงค์ข้อมูล
                                    </Button>
                                </div>
                            )}

                            {selected.allow_manual && isAdmin && (
                                <div>
                                    <div className="fw-semibold">กรอกข้อมูลรายหน่วยบริการ</div>
                                    <small className="text-muted d-block mb-3">
                                        เว้นว่าง = ใช้ค่าจาก HDC (ตัวเลขสีเทาในช่องคือค่าปัจจุบัน)
                                    </small>
                                    {loadingValues ? (
                                        <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
                                    ) : (
                                        <>
                                            <Row className="mb-2 d-none d-md-flex small text-muted fw-semibold">
                                                <Col md={4}>หน่วยบริการ</Col>
                                                <Col md={4}>เป้าหมาย</Col>
                                                <Col md={4}>ผลงาน</Col>
                                            </Row>
                                            {unitValues.map(u => (
                                                <Row key={u.hoscode} className="align-items-center mb-2 g-2">
                                                    <Col xs={12} md={4}>
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
                    <Button variant="secondary" onClick={closeModal}>ปิด</Button>
                    {selected && selected.allow_manual && isAdmin && (
                        <Button variant="primary" onClick={handleSave} disabled={loadingValues}>บันทึก</Button>
                    )}
                </Modal.Footer>
            </Modal>
        </div>
    );
}

function useFilteredKpis(kpis, tab, q) {
    return useMemo(() => {
        const text = q.trim().toLowerCase();
        if (tab === 'all' && !text) return kpis;
        return kpis.filter(k => !k.is_header
            && (tab === 'all' || kpiStatus(k) === tab)
            && (!text || k.name.toLowerCase().includes(text) || String(k.display_index || '').includes(text)));
    }, [kpis, tab, q]);
}

export default KpiGroupPage;
