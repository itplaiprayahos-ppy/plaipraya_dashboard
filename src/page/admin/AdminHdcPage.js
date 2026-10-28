import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Col, Row, Spinner, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import api, { errMsg } from '../../api';
import { FullPageLoading } from '../../components/Loading';
import { fmtDate } from '../../utils/kpi';
import { useAppData } from '../../context/AppDataContext';

const TH = { verticalAlign: 'middle' };

function AdminHdcPage() {
    const [data, setData] = useState(null);
    const [syncing, setSyncing] = useState({});
    const [syncAll, setSyncAll] = useState(false);
    const { year } = useAppData();

    const load = useCallback(async () => {
        if (!year) return;
        try {
            const res = await api.get('/hdc/tables', { params: { year } });
            setData(res.data);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: errMsg(err) });
        }
    }, [year]);

    useEffect(() => { load(); }, [load]);

    const syncOne = async (table) => {
        setSyncing(s => ({ ...s, [table]: true }));
        try {
            await api.post(`/hdc/sync/${table}`, { year });
        } catch (err) {
            Swal.fire({ icon: 'error', title: `ซิงค์ ${table} ไม่สำเร็จ`, text: errMsg(err) });
        } finally {
            setSyncing(s => ({ ...s, [table]: false }));
            load();
        }
    };

    const doSyncAll = async () => {
        const r = await Swal.fire({
            icon: 'question', title: `ซิงค์ทุกตารางของปี ${year}?`, text: 'อาจใช้เวลาหลายนาที',
            showCancelButton: true, confirmButtonText: 'เริ่มซิงค์', cancelButtonText: 'ยกเลิก',
        });
        if (!r.isConfirmed) return;
        setSyncAll(true);
        try {
            const res = await api.post('/hdc/sync-all', { year }, { timeout: 30 * 60 * 1000 });
            const failed = res.data.results.filter(x => !x.ok);
            Swal.fire({
                icon: failed.length ? 'warning' : 'success',
                title: failed.length ? `สำเร็จ ${res.data.results.length - failed.length} / ${res.data.results.length}` : 'ซิงค์ครบทุกตาราง',
                html: failed.map(f => `<div><b>${f.table_name}</b>: ${f.error}</div>`).join(''),
            });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ซิงค์ไม่สำเร็จ', text: errMsg(err) });
        } finally {
            setSyncAll(false);
            load();
        }
    };

    if (!data) return <FullPageLoading />;

    return (
        <div className="page">
            <Row className="align-items-center my-3">
                <Col>
                    <h1 className="page-title">ซิงค์ข้อมูล HDC</h1>
                    <small className="text-muted">ปีงบประมาณ {data.year} — ตารางทั้งหมดที่ตัวชี้วัดใช้งาน</small>
                </Col>
                <Col xs="auto">
                    <Button variant="success" onClick={doSyncAll} disabled={syncAll}>
                        {syncAll ? <><Spinner size="sm" animation="border" /> กำลังซิงค์...</> : <><i className="fa fa-sync me-1" /> ซิงค์ทั้งหมด</>}
                    </Button>
                </Col>
            </Row>

            <div className="panel"><Table hover responsive className="table-modern">
                <thead>
                    <tr>
                        <th style={TH}>tableName</th>
                        <th style={TH}>ใช้ในตัวชี้วัด</th>
                        <th style={TH} className="text-center">จำนวนแถว</th>
                        <th style={TH}>ซิงค์ล่าสุด</th>
                        <th style={{ ...TH, width: 110 }} className="text-center"></th>
                    </tr>
                </thead>
                <tbody>
                    {data.tables.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">ยังไม่มีตัวชี้วัดที่ใช้ข้อมูล HDC</td></tr>}
                    {data.tables.map(t => (
                        <tr key={t.table_name}>
                            <td><code>{t.table_name}</code></td>
                            <td className="small">{(t.kpis || []).map(n => <div key={n}>• {n}</div>)}</td>
                            <td className="text-center">{t.row_count.toLocaleString()}</td>
                            <td className="small">
                                {t.synced_at ? (
                                    <>
                                        {t.status === 'success' ? <Badge bg="success">สำเร็จ</Badge> : <Badge bg="danger">ล้มเหลว</Badge>}{' '}
                                        {fmtDate(t.synced_at)} โดย {t.synced_by || '-'}
                                        {t.error && <div className="text-danger">{t.error}</div>}
                                    </>
                                ) : <span className="text-muted">ยังไม่เคยซิงค์</span>}
                            </td>
                            <td className="text-center">
                                <Button size="sm" variant="outline-success" onClick={() => syncOne(t.table_name)} disabled={syncing[t.table_name] || syncAll}>
                                    {syncing[t.table_name] ? <Spinner size="sm" animation="border" /> : 'ซิงค์'}
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table></div>
        </div>
    );
}

export default AdminHdcPage;
