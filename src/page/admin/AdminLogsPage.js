import { Fragment, useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Container, Form, Pagination, Row, Spinner, Table } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import api, { errMsg } from '../../api';
import { fmtDate } from '../../utils/kpi';

const TH = { backgroundColor: '#0d9488', color: '#fff', verticalAlign: 'middle' };

// ชื่อภาษาไทยของแต่ละการกระทำ
export const ACTION_LABELS = {
    'auth.login': 'เข้าสู่ระบบ',
    'auth.login_failed': 'เข้าสู่ระบบไม่สำเร็จ',
    'auth.logout': 'ออกจากระบบ',
    'auth.signup': 'สมัครสมาชิก',
    'auth.rate_limited': 'ถูกระงับ (ลองรหัสผ่านบ่อย)',
    'user.profile': 'แก้ไขข้อมูลส่วนตัว',
    'user.role': 'เปลี่ยนสิทธิ์ผู้ใช้',
    'user.delete': 'ลบผู้ใช้',
    'user.password': 'เปลี่ยนรหัสผ่าน',
    'user.password_failed': 'เปลี่ยนรหัสผ่านไม่สำเร็จ',
    'user.password_reset': 'ตั้งรหัสผ่านใหม่ให้ผู้ใช้',
    'kpi.create': 'เพิ่มตัวชี้วัด',
    'kpi.update': 'แก้ไขตัวชี้วัด',
    'kpi.delete': 'ลบตัวชี้วัด',
    'kpi.reorder': 'เรียงลำดับตัวชี้วัด',
    'kpi.values': 'กรอกข้อมูลตัวชี้วัด',
    'kpi.sync': 'ซิงค์ตัวชี้วัด',
    'hdc.sync': 'ซิงค์ตาราง HDC',
    'hdc.sync_all': 'ซิงค์ HDC ทั้งหมด',
    'hdc.sync_failed': 'ซิงค์ไม่สำเร็จ',
    'group.create': 'เพิ่มกลุ่ม',
    'group.update': 'แก้ไขกลุ่ม',
    'group.delete': 'ลบกลุ่ม',
    'year.create': 'สร้างปีงบประมาณ',
    'year.delete': 'ลบปีงบประมาณ',
    'settings.update': 'แก้ไขการตั้งค่า',
    'unit.create': 'เพิ่มหน่วยบริการ',
    'unit.update': 'แก้ไขหน่วยบริการ',
    'unit.delete': 'ลบหน่วยบริการ',
    'ppfee.year_create': 'เพิ่มปี PP Fee',
    'ppfee.year_status': 'เปลี่ยนสถานะปี PP Fee',
    'ppfee.create': 'เพิ่มกิจกรรม PP Fee',
    'ppfee.update': 'แก้ไขกิจกรรม PP Fee',
    'ppfee.delete': 'ลบกิจกรรม PP Fee',
    'system.error': 'ข้อผิดพลาดของระบบ',
};

const CATEGORIES = [
    { value: '', label: 'ทั้งหมด' },
    { value: 'auth', label: 'เข้าสู่ระบบ / ออกจากระบบ' },
    { value: 'kpi', label: 'ตัวชี้วัด / กรอกข้อมูล' },
    { value: 'hdc', label: 'ซิงค์ HDC' },
    { value: 'user', label: 'ผู้ใช้งาน' },
    { value: 'group', label: 'กลุ่มตัวชี้วัด' },
    { value: 'year', label: 'ปีงบประมาณ' },
    { value: 'settings', label: 'ตั้งค่าระบบ' },
    { value: 'unit', label: 'หน่วยบริการ' },
    { value: 'ppfee', label: 'PP Fee' },
    { value: 'system', label: 'ข้อผิดพลาดของระบบ' },
];

const LEVEL = {
    info: { bg: 'secondary', label: 'ปกติ' },
    warn: { bg: 'warning', label: 'เตือน' },
    error: { bg: 'danger', label: 'ผิดพลาด' },
};

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
const daysAgo = (n) => {
    const d = new Date(Date.now() - n * 86400000);
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
};

function SummaryCard({ title, value, color }) {
    return (
        <Card className="text-center h-100" style={{ borderTop: `4px solid ${color}` }}>
            <Card.Body className="py-3">
                <div className="text-muted small">{title}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value ?? '-'}</div>
            </Card.Body>
        </Card>
    );
}

function AdminLogsPage() {
    const [params] = useSearchParams();
    const [filters, setFilters] = useState({
        from: daysAgo(6), to: today(), action: '', username: params.get('username') || '', level: '', q: '',
    });
    const [applied, setApplied] = useState(filters);
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState({});
    const limit = 50;

    useEffect(() => {
        api.get('/admin/logs/meta').then(res => setMeta(res.data)).catch(() => {});
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/logs', { params: { ...applied, page, limit } });
            setData(res.data);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'โหลดบันทึกไม่สำเร็จ', text: errMsg(err) });
        } finally {
            setLoading(false);
        }
    }, [applied, page]);

    useEffect(() => { load(); }, [load]);

    const apply = (e) => {
        if (e) e.preventDefault();
        setPage(1);
        setApplied({ ...filters });
        setOpen({});
    };

    const quickRange = (days) => {
        const f = { ...filters, from: days === 0 ? today() : daysAgo(days - 1), to: today() };
        setFilters(f);
        setPage(1);
        setApplied(f);
    };

    const exportExcel = async () => {
        try {
            const res = await api.get('/admin/logs', { params: { ...applied, page: 1, limit: 1000 } });
            const rows = res.data.rows.map(r => ({
                'วันเวลา': fmtDate(r.at),
                'ระดับ': (LEVEL[r.level] || {}).label || r.level,
                'การกระทำ': ACTION_LABELS[r.action] || r.action,
                'ชื่อผู้ใช้': r.username || '',
                'ชื่อ-สกุล': r.user_name || '',
                'IP': r.ip || '',
                'รายละเอียด': r.message || '',
            }));
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'logs');
            XLSX.writeFile(wb, `บันทึกการใช้งาน ${applied.from || ''}_${applied.to || ''}.xlsx`);
            if (res.data.total > 1000) {
                Swal.fire({ icon: 'info', title: 'ส่งออก 1,000 รายการล่าสุด', text: `จากทั้งหมด ${res.data.total.toLocaleString()} รายการ — กรองช่วงวันที่ให้แคบลงเพื่อส่งออกส่วนที่เหลือ` });
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ส่งออกไม่สำเร็จ', text: errMsg(err) });
        }
    };

    const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
    const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));
    const s = meta && meta.last7days;

    return (
        <Container fluid className="pb-5" style={{ backgroundColor: '#f8f9fa', padding: 25 }}>
            <h2 className="my-3" style={{ fontWeight: 700, color: '#2c3e50' }}>บันทึกการใช้งาน</h2>

            <Row className="g-3 mb-3">
                <Col md={3} xs={6}><SummaryCard title="เข้าสู่ระบบ (7 วัน)" value={s && s.logins} color="#0d9488" /></Col>
                <Col md={3} xs={6}><SummaryCard title="ผู้ใช้ที่เข้าระบบ (7 วัน)" value={s && s.active_users} color="#0575e6" /></Col>
                <Col md={3} xs={6}><SummaryCard title="เข้าสู่ระบบไม่สำเร็จ (7 วัน)" value={s && s.login_failed} color="#f39c12" /></Col>
                <Col md={3} xs={6}><SummaryCard title="ข้อผิดพลาด (7 วัน)" value={s && s.errors} color="#e74c3c" /></Col>
            </Row>

            <Card className="mb-3">
                <Card.Body>
                    <Form onSubmit={apply}>
                        <Row className="g-2 align-items-end">
                            <Col md={2} xs={6}>
                                <Form.Label className="small mb-1">ตั้งแต่วันที่</Form.Label>
                                <Form.Control type="date" size="sm" value={filters.from} onChange={e => set('from', e.target.value)} />
                            </Col>
                            <Col md={2} xs={6}>
                                <Form.Label className="small mb-1">ถึงวันที่</Form.Label>
                                <Form.Control type="date" size="sm" value={filters.to} onChange={e => set('to', e.target.value)} />
                            </Col>
                            <Col md={2} xs={6}>
                                <Form.Label className="small mb-1">หมวด</Form.Label>
                                <Form.Select size="sm" value={filters.action} onChange={e => set('action', e.target.value)}>
                                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    {meta && meta.actions.length > 0 && <option disabled>──────────</option>}
                                    {meta && meta.actions.map(a => <option key={a} value={a}>· {ACTION_LABELS[a] || a}</option>)}
                                </Form.Select>
                            </Col>
                            <Col md={2} xs={6}>
                                <Form.Label className="small mb-1">ผู้ใช้</Form.Label>
                                <Form.Select size="sm" value={filters.username} onChange={e => set('username', e.target.value)}>
                                    <option value="">ทุกคน</option>
                                    {meta && meta.usernames.map(u => <option key={u} value={u}>{u}</option>)}
                                    {filters.username && meta && !meta.usernames.includes(filters.username) && (
                                        <option value={filters.username}>{filters.username}</option>
                                    )}
                                </Form.Select>
                            </Col>
                            <Col md={1} xs={6}>
                                <Form.Label className="small mb-1">ระดับ</Form.Label>
                                <Form.Select size="sm" value={filters.level} onChange={e => set('level', e.target.value)}>
                                    <option value="">ทั้งหมด</option>
                                    <option value="info">ปกติ</option>
                                    <option value="warn">เตือน</option>
                                    <option value="error">ผิดพลาด</option>
                                </Form.Select>
                            </Col>
                            <Col md={2} xs={6}>
                                <Form.Label className="small mb-1">ค้นหาข้อความ / IP</Form.Label>
                                <Form.Control size="sm" value={filters.q} placeholder="เช่น s_dm_control" onChange={e => set('q', e.target.value)} />
                            </Col>
                            <Col md={1} xs={12}>
                                <Button type="submit" size="sm" variant="success" className="w-100">ค้นหา</Button>
                            </Col>
                        </Row>
                    </Form>
                    <div className="d-flex flex-wrap gap-2 mt-2 align-items-center">
                        <small className="text-muted">ช่วงเวลา:</small>
                        <Button size="sm" variant="outline-secondary" onClick={() => quickRange(0)}>วันนี้</Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => quickRange(7)}>7 วัน</Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => quickRange(30)}>30 วัน</Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => quickRange(365)}>1 ปี</Button>
                        <div className="ms-auto">
                            <Button size="sm" variant="outline-success" onClick={exportExcel}>
                                <i className="fa fa-file-excel me-1" /> ส่งออก Excel
                            </Button>
                        </div>
                    </div>
                </Card.Body>
            </Card>

            <div className="d-flex justify-content-between align-items-center mb-2">
                <small className="text-muted">
                    {data ? `พบ ${data.total.toLocaleString()} รายการ` : ''}
                    {loading && <Spinner size="sm" animation="border" className="ms-2" />}
                </small>
            </div>

            <Table bordered hover responsive size="sm" className="bg-white">
                <thead>
                    <tr>
                        <th style={{ ...TH, width: 165 }}>วันเวลา</th>
                        <th style={{ ...TH, width: 70 }} className="text-center">ระดับ</th>
                        <th style={{ ...TH, width: 180 }}>การกระทำ</th>
                        <th style={{ ...TH, width: 170 }}>ผู้ใช้</th>
                        <th style={{ ...TH, width: 120 }}>IP</th>
                        <th style={TH}>รายละเอียด</th>
                    </tr>
                </thead>
                <tbody>
                    {data && data.rows.length === 0 && (
                        <tr><td colSpan={6} className="text-center text-muted py-4">ไม่พบบันทึกตามเงื่อนไข</td></tr>
                    )}
                    {data && data.rows.map(r => {
                        const lv = LEVEL[r.level] || LEVEL.info;
                        return (
                            <Fragment key={r.id}>
                                <tr>
                                    <td className="small text-nowrap">{fmtDate(r.at)}</td>
                                    <td className="text-center"><Badge bg={lv.bg}>{lv.label}</Badge></td>
                                    <td className="small">{ACTION_LABELS[r.action] || r.action}</td>
                                    <td className="small">
                                        {r.username || '-'}
                                        {r.user_name && r.user_name !== r.username && <div className="text-muted">{r.user_name}</div>}
                                    </td>
                                    <td className="small">{r.ip || '-'}</td>
                                    <td className="small" style={{ wordBreak: 'break-word' }}>
                                        {r.message}
                                        {r.detail && (
                                            <Button size="sm" variant="link" className="p-0 ms-2"
                                                onClick={() => setOpen(o => ({ ...o, [r.id]: !o[r.id] }))}>
                                                {open[r.id] ? 'ซ่อน' : 'ข้อมูลเพิ่มเติม'}
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                                {open[r.id] && (
                                    <tr>
                                        <td colSpan={6} className="bg-light">
                                            <pre className="mb-0 small" style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
                                                {JSON.stringify(r.detail, null, 2)}
                                            </pre>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
            </Table>

            {data && totalPages > 1 && (
                <Pagination className="justify-content-center">
                    <Pagination.First disabled={page === 1} onClick={() => setPage(1)} />
                    <Pagination.Prev disabled={page === 1} onClick={() => setPage(p => p - 1)} />
                    <Pagination.Item active>{page} / {totalPages}</Pagination.Item>
                    <Pagination.Next disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} />
                    <Pagination.Last disabled={page >= totalPages} onClick={() => setPage(totalPages)} />
                </Pagination>
            )}
        </Container>
    );
}

export default AdminLogsPage;
