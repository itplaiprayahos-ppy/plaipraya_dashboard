import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Col, Form, InputGroup, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import api, { errMsg } from '../../api';
import { useAppData } from '../../context/AppDataContext';
import { FullPageLoading, OverlayLoading } from '../../components/Loading';
import { MULTIPLIER_PRESETS, OP_OPTIONS, formatCriterion } from '../../utils/kpi';

const TH = { verticalAlign: 'middle' };

const emptyKpi = (groupId) => ({
    group_id: groupId,
    display_index: '',
    name: '',
    is_header: false,
    criterion: '',
    criterion_op: '>=',
    multiplier: 100,
    unit_label: '%',
    link: '',
    summary_scope: 'unit',
    summary_hoscode: '',
    allow_manual: false,
    active: true,
    sources: [],
});

const emptySource = () => ({ table_name: '', target_fields: '', result_fields: '' });
const joinFields = (v) => (Array.isArray(v) ? v.join(', ') : v || '');
const splitFields = (v) => String(v || '').split(/[\s,+]+/).map(s => s.trim()).filter(Boolean);

// ---------- ตัวช่วยเลือกฟิลด์จาก HDC ----------
function FieldPicker({ tableName, onAdd }) {
    const [fields, setFields] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('');

    const load = async (live) => {
        if (!tableName) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/hdc/fields/${encodeURIComponent(tableName)}`, { params: live ? { live: 1 } : {} });
            setFields(res.data);
        } catch (err) {
            setError(errMsg(err, 'ดึงรายชื่อฟิลด์ไม่สำเร็จ'));
        } finally {
            setLoading(false);
        }
    };

    const skip = ['id', 'hospcode', 'areacode', 'date_com', 'b_year', 'yymm', 'date_fz'];
    const list = fields ? fields.fields.filter(f => !skip.includes(f.name) && f.name.toLowerCase().includes(filter.toLowerCase())) : [];

    return (
        <div className="mt-2">
            <Button size="sm" variant="outline-secondary" onClick={() => load(false)} disabled={!tableName || loading}>
                {loading ? <Spinner size="sm" animation="border" /> : <><i className="fa fa-list me-1" />ดูรายชื่อฟิลด์</>}
            </Button>
            {fields && fields.source === 'local' && (
                <Button size="sm" variant="link" onClick={() => load(true)}>ดึงจาก HDC ใหม่</Button>
            )}
            {error && <div className="text-danger small mt-1">{error}</div>}
            {fields && (
                <div className="border rounded p-2 mt-2 bg-white">
                    <div className="d-flex align-items-center gap-2 mb-2">
                        <small className="text-muted">
                            {fields.fields.length} ฟิลด์ (จาก{fields.source === 'local' ? 'ข้อมูลที่ซิงค์ไว้' : ' HDC'}) — กดเพื่อเพิ่ม
                        </small>
                        <Form.Control size="sm" style={{ maxWidth: 200 }} placeholder="ค้นหาฟิลด์" value={filter} onChange={e => setFilter(e.target.value)} />
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                        {list.map(f => (
                            <span key={f.name} className="d-inline-flex align-items-center border rounded me-1 mb-1 px-1 small">
                                <code className="me-1">{f.name}</code>
                                <span className="text-muted me-1">= {String(f.sample).slice(0, 10)}</span>
                                <Button size="sm" variant="link" className="p-0 me-1" onClick={() => onAdd('target_fields', f.name)}>+เป้า</Button>
                                <Button size="sm" variant="link" className="p-0" onClick={() => onAdd('result_fields', f.name)}>+ผลงาน</Button>
                            </span>
                        ))}
                        {list.length === 0 && <small className="text-muted">ไม่พบฟิลด์</small>}
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------- ฟอร์มแก้ไขตัวชี้วัด ----------
function KpiForm({ value, onChange, groups, units, defaultHoscode }) {
    const set = (field, v) => onChange({ ...value, [field]: v });
    const setSource = (i, field, v) => {
        const sources = value.sources.map((s, idx) => (idx === i ? { ...s, [field]: v } : s));
        onChange({ ...value, sources });
    };
    const addField = (i, field, name) => {
        const cur = splitFields(value.sources[i][field]);
        if (!cur.includes(name)) setSource(i, field, [...cur, name].join(', '));
    };
    const preset = MULTIPLIER_PRESETS.find(p => Number(p.value) === Number(value.multiplier));

    return (
        <Form>
            <Row className="g-3">
                <Col md={4}>
                    <Form.Label>กลุ่ม</Form.Label>
                    <Form.Select value={value.group_id} onChange={e => set('group_id', Number(e.target.value))}>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </Form.Select>
                </Col>
                <Col md={2}>
                    <Form.Label>ลำดับที่แสดง</Form.Label>
                    <Form.Control value={value.display_index} placeholder="เช่น 1, 6.1" onChange={e => set('display_index', e.target.value)} />
                </Col>
                <Col md={6} className="d-flex align-items-end gap-4">
                    <Form.Check type="switch" id="kpi-header" label="เป็นหัวข้อ (ไม่มีค่า)" checked={value.is_header} onChange={e => set('is_header', e.target.checked)} />
                    <Form.Check type="switch" id="kpi-active" label="แสดงผล" checked={value.active} onChange={e => set('active', e.target.checked)} />
                </Col>
                <Col xs={12}>
                    <Form.Label>ชื่อตัวชี้วัด</Form.Label>
                    <Form.Control as="textarea" rows={2} value={value.name} onChange={e => set('name', e.target.value)} />
                </Col>

                {!value.is_header && (
                    <>
                        <Col md={5}>
                            <Form.Label>เงื่อนไขผ่านเกณฑ์</Form.Label>
                            <Form.Select value={value.criterion_op} onChange={e => set('criterion_op', e.target.value)}>
                                {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Form.Select>
                        </Col>
                        <Col md={2}>
                            <Form.Label>เกณฑ์</Form.Label>
                            <Form.Control inputMode="decimal" value={value.criterion ?? ''} onChange={e => set('criterion', e.target.value)} />
                        </Col>
                        <Col md={3}>
                            <Form.Label>วิธีคำนวณ (ผลงาน × ? ÷ เป้า)</Form.Label>
                            <Form.Select
                                value={preset ? preset.value : 'custom'}
                                onChange={e => {
                                    if (e.target.value === 'custom') return set('multiplier', value.multiplier);
                                    const p = MULTIPLIER_PRESETS.find(x => String(x.value) === e.target.value);
                                    onChange({ ...value, multiplier: p.value, unit_label: p.unit });
                                }}
                            >
                                {MULTIPLIER_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                <option value="custom">กำหนดเอง</option>
                            </Form.Select>
                            {!preset && (
                                <Form.Control className="mt-1" inputMode="decimal" value={value.multiplier} onChange={e => set('multiplier', e.target.value)} />
                            )}
                        </Col>
                        <Col md={2}>
                            <Form.Label>หน่วย</Form.Label>
                            <Form.Control value={value.unit_label} placeholder="%" onChange={e => set('unit_label', e.target.value)} />
                        </Col>

                        <Col md={6}>
                            <Form.Label>ผลสรุปของตัวชี้วัดใช้ค่าจาก</Form.Label>
                            <InputGroup>
                                <Form.Select value={value.summary_scope} onChange={e => set('summary_scope', e.target.value)}>
                                    <option value="unit">หน่วยบริการเดียว</option>
                                    <option value="all">รวมทุกหน่วยบริการ</option>
                                </Form.Select>
                                {value.summary_scope === 'unit' && (
                                    <Form.Select value={value.summary_hoscode || ''} onChange={e => set('summary_hoscode', e.target.value)}>
                                        <option value="">ค่าเริ่มต้น ({defaultHoscode})</option>
                                        {units.map(u => <option key={u.hoscode} value={u.hoscode}>{u.hoscode} {u.short_name || u.name}</option>)}
                                        {value.summary_hoscode && !units.some(u => u.hoscode === value.summary_hoscode) && (
                                            <option value={value.summary_hoscode}>{value.summary_hoscode}</option>
                                        )}
                                    </Form.Select>
                                )}
                            </InputGroup>
                        </Col>
                        <Col md={6}>
                            <Form.Label>ลิงก์อ้างอิง (ที่มา)</Form.Label>
                            <Form.Control value={value.link} placeholder="https://hdc.moph.go.th/..." onChange={e => set('link', e.target.value)} />
                        </Col>
                        <Col xs={12}>
                            <Form.Check type="switch" id="kpi-manual" label="เปิดให้กรอกเป้าหมาย/ผลงานเอง (รายหน่วยบริการ)" checked={value.allow_manual} onChange={e => set('allow_manual', e.target.checked)} />
                        </Col>

                        <Col xs={12}>
                            <div className="d-flex justify-content-between align-items-center">
                                <Form.Label className="mb-0 fw-bold">แหล่งข้อมูล HDC</Form.Label>
                                <Button size="sm" variant="outline-primary" onClick={() => onChange({ ...value, sources: [...value.sources, emptySource()] })}>
                                    + เพิ่มตาราง
                                </Button>
                            </div>
                            <small className="text-muted d-block mb-2">
                                ระบบจะรวมค่าฟิลด์เป้าหมาย/ผลงานของทุกตาราง แล้วคำนวณ ผลงาน × ตัวคูณ ÷ เป้าหมาย
                                (ไม่มีตาราง = ตัวชี้วัดกรอกเอง)
                            </small>
                            {value.sources.map((s, i) => (
                                <div key={i} className="border rounded p-3 mb-2 bg-light">
                                    <Row className="g-2">
                                        <Col md={4}>
                                            <Form.Label className="small">tableName (opendata.moph.go.th)</Form.Label>
                                            <Form.Control size="sm" value={s.table_name} placeholder="เช่น s_dm_control" onChange={e => setSource(i, 'table_name', e.target.value.trim())} />
                                        </Col>
                                        <Col md={4}>
                                            <Form.Label className="small">ฟิลด์เป้าหมาย (คั่นด้วย ,)</Form.Label>
                                            <Form.Control size="sm" value={joinFields(s.target_fields)} placeholder="target" onChange={e => setSource(i, 'target_fields', e.target.value)} />
                                        </Col>
                                        <Col md={3}>
                                            <Form.Label className="small">ฟิลด์ผลงาน (คั่นด้วย ,)</Form.Label>
                                            <Form.Control size="sm" value={joinFields(s.result_fields)} placeholder="result" onChange={e => setSource(i, 'result_fields', e.target.value)} />
                                        </Col>
                                        <Col md={1} className="d-flex align-items-end">
                                            <Button size="sm" variant="outline-danger" title="ลบตาราง"
                                                onClick={() => onChange({ ...value, sources: value.sources.filter((_, idx) => idx !== i) })}>
                                                <i className="fa fa-trash" />
                                            </Button>
                                        </Col>
                                    </Row>
                                    <FieldPicker tableName={s.table_name} onAdd={(field, name) => addField(i, field, name)} />
                                </div>
                            ))}
                        </Col>
                    </>
                )}
            </Row>
        </Form>
    );
}

// ---------- หน้าหลักจัดการตัวชี้วัด ----------
function AdminKpiPage() {
    const [params, setParams] = useSearchParams();
    const { reload: reloadAppData, settings, year, years } = useAppData();
    const [groups, setGroups] = useState([]);
    const [groupsLoaded, setGroupsLoaded] = useState(false);
    const [units, setUnits] = useState([]);
    const [kpis, setKpis] = useState(null);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(null); // { mode: 'new'|'edit', value, afterId }
    const [filter, setFilter] = useState('');

    const groupId = Number(params.get('group')) || (groups[0] && groups[0].id);

    useEffect(() => {
        Promise.all([api.get('/groups', { params: { all: 1 } }), api.get('/units')])
            .then(([g, u]) => { setGroups(g.data); setUnits(u.data); })
            .catch(err => Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: errMsg(err) }))
            .finally(() => setGroupsLoaded(true));
    }, []);

    const loadKpis = useCallback(async () => {
        if (!groupId || !year) return;
        try {
            const res = await api.get('/admin/kpis', { params: { group_id: groupId, year } });
            setKpis(res.data);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'โหลดตัวชี้วัดไม่สำเร็จ', text: errMsg(err) });
        }
    }, [groupId, year]);

    useEffect(() => { setKpis(null); loadKpis(); }, [loadKpis]);

    const visible = useMemo(() => {
        if (!kpis) return [];
        const f = filter.trim().toLowerCase();
        return f ? kpis.filter(k => k.name.toLowerCase().includes(f) || (k.display_index || '').includes(f)) : kpis;
    }, [kpis, filter]);

    const move = async (index, dir) => {
        const list = [...kpis];
        const j = index + dir;
        if (j < 0 || j >= list.length) return;
        [list[index], list[j]] = [list[j], list[index]];
        setKpis(list);
        try {
            await api.post('/admin/kpis/reorder', { ids: list.map(k => k.id) });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'เรียงลำดับไม่สำเร็จ', text: errMsg(err) });
            loadKpis();
        }
    };

    const openNew = (afterId) => setEditing({ mode: 'new', afterId, value: emptyKpi(groupId) });
    const openEdit = (k) => setEditing({
        mode: 'edit',
        id: k.id,
        value: {
            ...k,
            criterion: k.criterion ?? '',
            summary_hoscode: k.summary_hoscode || '',
            sources: k.sources.map(s => ({ ...s, target_fields: joinFields(s.target_fields), result_fields: joinFields(s.result_fields) })),
        },
    });

    const save = async () => {
        const v = editing.value;
        const payload = {
            ...v,
            sources: v.sources.map(s => ({ table_name: s.table_name, target_fields: splitFields(s.target_fields), result_fields: splitFields(s.result_fields) })),
        };
        setBusy(true);
        try {
            if (editing.mode === 'new') {
                await api.post('/admin/kpis', { ...payload, b_year: year, after_id: editing.afterId });
            } else {
                await api.put(`/admin/kpis/${editing.id}`, payload);
            }
            setEditing(null);
            await loadKpis();
            reloadAppData();
            Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errMsg(err) });
        } finally {
            setBusy(false);
        }
    };

    const remove = async (k) => {
        const r = await Swal.fire({
            icon: 'warning', title: 'ลบตัวชี้วัด?', text: `"${k.name}" และค่าที่กรอกไว้จะถูกลบ`,
            showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc3545',
        });
        if (!r.isConfirmed) return;
        try {
            await api.delete(`/admin/kpis/${k.id}`);
            loadKpis();
            reloadAppData();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: errMsg(err) });
        }
    };

    if (!groupsLoaded) return <FullPageLoading />;

    return (
        <div className="page">
            <OverlayLoading show={busy} />
            <Row className="align-items-center my-3">
                <Col>
                    <h1 className="page-title">จัดการตัวชี้วัด ปีงบประมาณ {year}</h1>
                    <small className="text-muted">เปลี่ยนปีได้ที่ช่อง "ปีงบประมาณ" ด้านบนขวา — ตัวชี้วัดของแต่ละปีแยกกัน</small>
                </Col>
                <Col xs="auto">
                    <Button as={Link} to="/admin/years" variant="outline-secondary" size="sm">
                        <i className="fa fa-calendar-alt me-1" /> จัดการปีงบประมาณ
                    </Button>
                </Col>
            </Row>

            {groups.length === 0 ? (
                <Alert variant="info">ยังไม่มีกลุ่มตัวชี้วัด กรุณาเพิ่มกลุ่มที่เมนู "กลุ่มตัวชี้วัด" ก่อน</Alert>
            ) : (
                <>
                    <Row className="g-2 align-items-center mb-3">
                        <Col md={4}>
                            <Form.Select value={groupId || ''} onChange={e => setParams({ group: e.target.value })}>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.active ? '' : ' (ซ่อน)'}</option>)}
                            </Form.Select>
                        </Col>
                        <Col md={4}>
                            <Form.Control placeholder="ค้นหาชื่อตัวชี้วัด" value={filter} onChange={e => setFilter(e.target.value)} />
                        </Col>
                        <Col md={4} className="text-md-end">
                            <Button variant="success" onClick={() => openNew(null)}><i className="fa fa-plus me-1" /> เพิ่มตัวชี้วัด</Button>
                        </Col>
                    </Row>

                    {kpis && kpis.length === 0 && !filter && years.length > 1 && (
                        <Alert variant="info">
                            กลุ่มนี้ยังไม่มีตัวชี้วัดในปีงบประมาณ {year} — เพิ่มทีละรายการ หรือ{' '}
                            <Link to="/admin/years">คัดลอกตัวชี้วัดทั้งหมดจากปีก่อน</Link> (ตอนสร้างปีใหม่)
                        </Alert>
                    )}
                    {kpis === null ? <FullPageLoading /> : (
                        <div className="panel"><Table hover responsive className="table-modern">
                            <thead>
                                <tr>
                                    <th style={{ ...TH, width: 90 }} className="text-center">เรียง</th>
                                    <th style={{ ...TH, width: 60 }} className="text-center">ลำดับ</th>
                                    <th style={TH}>ตัวชี้วัด</th>
                                    <th style={TH} className="text-center">เกณฑ์</th>
                                    <th style={TH}>แหล่งข้อมูล</th>
                                    <th style={{ ...TH, width: 150 }} className="text-center">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">ไม่มีตัวชี้วัด</td></tr>}
                                {visible.map(k => {
                                    const idx = kpis.indexOf(k);
                                    return (
                                        <tr key={k.id} style={{ opacity: k.active ? 1 : 0.5 }}>
                                            <td className="text-center">
                                                <ButtonGroup size="sm">
                                                    <Button variant="outline-secondary" disabled={!!filter || idx === 0} onClick={() => move(idx, -1)} title="เลื่อนขึ้น">▲</Button>
                                                    <Button variant="outline-secondary" disabled={!!filter || idx === kpis.length - 1} onClick={() => move(idx, 1)} title="เลื่อนลง">▼</Button>
                                                </ButtonGroup>
                                            </td>
                                            <td className="text-center">{k.display_index}</td>
                                            <td className={k.is_header ? 'fw-bold' : ''}>
                                                {k.name}
                                                {k.is_header && <Badge bg="secondary" className="ms-2">หัวข้อ</Badge>}
                                                {!k.active && <Badge bg="dark" className="ms-2">ซ่อน</Badge>}
                                            </td>
                                            <td className="text-center text-nowrap">{k.is_header ? '' : formatCriterion(k)}</td>
                                            <td className="small">
                                                {k.sources.map(s => <Badge key={s.id} bg="primary" className="me-1">{s.table_name}</Badge>)}
                                                {k.allow_manual && <Badge bg="info">กรอกเอง</Badge>}
                                            </td>
                                            <td className="text-center text-nowrap">
                                                <Button size="sm" variant="outline-primary" className="me-1" onClick={() => openEdit(k)} title="แก้ไข"><i className="fa fa-edit" /></Button>
                                                <Button size="sm" variant="outline-success" className="me-1" onClick={() => openNew(k.id)} title="แทรกตัวชี้วัดใหม่ด้านล่าง"><i className="fa fa-level-down-alt" /></Button>
                                                <Button size="sm" variant="outline-danger" onClick={() => remove(k)} title="ลบ"><i className="fa fa-trash" /></Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table></div>
                    )}
                </>
            )}

            <Modal show={!!editing} onHide={() => setEditing(null)} size="xl" centered scrollable backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title>{editing && editing.mode === 'new' ? 'เพิ่มตัวชี้วัด' : 'แก้ไขตัวชี้วัด'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {editing && (
                        <KpiForm
                            value={editing.value}
                            onChange={value => setEditing({ ...editing, value })}
                            groups={groups}
                            units={units}
                            defaultHoscode={settings.default_hoscode}
                        />
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

export default AdminKpiPage;
