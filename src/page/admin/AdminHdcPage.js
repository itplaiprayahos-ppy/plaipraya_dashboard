import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { FiAlertTriangle, FiCheckCircle, FiClock, FiRefreshCw, FiXCircle } from 'react-icons/fi';
import api, { errMsg } from '../../api';
import { FullPageLoading } from '../../components/Loading';
import PageHeader from '../../components/PageHeader';
import { fmtDate } from '../../utils/kpi';
import { useAppData } from '../../context/AppDataContext';
import { alertText, notifyAlertsChanged, useAlerts } from '../../context/AlertsContext';

const PILL = {
    sync_failed: ['bad', 'ซิงค์ล้มเหลว'],
    never_synced: ['warn', 'ยังไม่เคยซิงค์'],
    stale: ['warn', 'ข้อมูลเก่า'],
};

// สรุปการแจ้งเตือนด้านบนหน้า
function AlertSummary({ alerts, onSyncProblems, busy }) {
    if (!alerts) return null;
    const { summary, stale_days: staleDays, alerts: list } = alerts;
    if (list.length === 0) {
        return (
            <div className="alert-banner ok">
                <span className="ab-ic"><FiCheckCircle size={20} /></span>
                <div className="ab-text">
                    <b>ข้อมูล HDC เป็นปัจจุบันทุกตาราง</b>
                    <small>
                        {staleDays > 0 ? `ทุกตารางซิงค์สำเร็จภายใน ${staleDays} วัน` : 'ปิดการเตือนข้อมูลเก่าอยู่'} —
                        ตั้งจำนวนวันได้ที่ <Link to="/admin/settings">ตั้งค่าระบบ</Link>
                    </small>
                </div>
            </div>
        );
    }
    const danger = summary.sync_failed > 0;
    const parts = [];
    if (summary.sync_failed) parts.push(`ซิงค์ล้มเหลว ${summary.sync_failed} ตาราง`);
    if (summary.stale) parts.push(`ไม่ได้อัปเดตเกิน ${staleDays} วัน ${summary.stale} ตาราง`);
    if (summary.never_synced) parts.push(`ยังไม่เคยซิงค์ ${summary.never_synced} ตาราง`);
    return (
        <div className={`alert-banner ${danger ? 'danger' : 'warning'}`}>
            <span className="ab-ic">{danger ? <FiXCircle size={20} /> : <FiAlertTriangle size={20} />}</span>
            <div className="ab-text">
                <b>มีตาราง HDC ที่ต้องตรวจสอบ {list.length} ตาราง</b>
                <small>{parts.join(' · ')} — ตัวชี้วัดที่ใช้ตารางเหล่านี้อาจแสดงข้อมูลไม่เป็นปัจจุบัน</small>
            </div>
            <Button variant={danger ? 'danger' : 'warning'} className="btn-icon" onClick={onSyncProblems} disabled={busy}>
                <FiRefreshCw /> ซิงค์เฉพาะตารางที่มีปัญหา
            </Button>
        </div>
    );
}

function AdminHdcPage() {
    const [data, setData] = useState(null);
    const [syncing, setSyncing] = useState({});
    const [syncAll, setSyncAll] = useState(false);
    const { year } = useAppData();
    const { data: alerts } = useAlerts();

    const alertMap = useMemo(() => new Map((alerts ? alerts.alerts : []).map(a => [a.table_name, a])), [alerts]);

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

    const afterSync = () => { load(); notifyAlertsChanged(); };

    const syncOne = async (table) => {
        setSyncing(s => ({ ...s, [table]: true }));
        try {
            await api.post(`/hdc/sync/${table}`, { year });
        } catch (err) {
            Swal.fire({ icon: 'error', title: `ซิงค์ ${table} ไม่สำเร็จ`, text: errMsg(err) });
        } finally {
            setSyncing(s => ({ ...s, [table]: false }));
            afterSync();
        }
    };

    // ซิงค์ทีละตาราง (ใช้กับ "ตารางที่มีปัญหา")
    const syncList = async (tables) => {
        setSyncAll(true);
        const failed = [];
        for (const t of tables) {
            setSyncing(s => ({ ...s, [t]: true }));
            try {
                await api.post(`/hdc/sync/${t}`, { year });
            } catch (err) {
                failed.push({ table_name: t, error: errMsg(err) });
            } finally {
                setSyncing(s => ({ ...s, [t]: false }));
            }
        }
        setSyncAll(false);
        afterSync();
        Swal.fire({
            icon: failed.length ? 'warning' : 'success',
            title: failed.length ? `สำเร็จ ${tables.length - failed.length} / ${tables.length}` : 'ซิงค์สำเร็จทุกตาราง',
            html: failed.map(f => `<div class="text-start small"><b>${f.table_name}</b>: ${f.error}</div>`).join(''),
        });
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
                html: failed.map(f => `<div class="text-start small"><b>${f.table_name}</b>: ${f.error}</div>`).join(''),
            });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ซิงค์ไม่สำเร็จ', text: errMsg(err) });
        } finally {
            setSyncAll(false);
            afterSync();
        }
    };

    if (!data) return <FullPageLoading />;

    // ตารางที่มีปัญหาขึ้นก่อน
    const rows = [...data.tables].sort((a, b) => {
        const ra = alertMap.get(a.table_name), rb = alertMap.get(b.table_name);
        const w = (x) => (!x ? 2 : x.level === 'danger' ? 0 : 1);
        return w(ra) - w(rb) || a.table_name.localeCompare(b.table_name);
    });

    return (
        <div className="page">
            <PageHeader title="ซิงค์ข้อมูล HDC" sub={`ปีงบประมาณ ${data.year} · ${data.tables.length} ตารางที่ตัวชี้วัดใช้งาน`}>
                <Button variant="primary" className="btn-icon" onClick={doSyncAll} disabled={syncAll}>
                    {syncAll ? <><Spinner size="sm" animation="border" /> กำลังซิงค์...</> : <><FiRefreshCw /> ซิงค์ทั้งหมด</>}
                </Button>
            </PageHeader>

            <AlertSummary
                alerts={alerts}
                busy={syncAll}
                onSyncProblems={() => syncList(alerts.alerts.map(a => a.table_name))}
            />

            <div className="panel"><Table hover responsive className="table-modern">
                <thead>
                    <tr>
                        <th>tableName</th>
                        <th>ใช้ในตัวชี้วัด</th>
                        <th className="text-center">สถานะ</th>
                        <th className="num">จำนวนแถว</th>
                        <th>ซิงค์ล่าสุด</th>
                        <th style={{ width: 110 }} className="text-center"></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">ยังไม่มีตัวชี้วัดที่ใช้ข้อมูล HDC</td></tr>}
                    {rows.map(t => {
                        const a = alertMap.get(t.table_name);
                        const [tone, label] = a ? PILL[a.type] : ['ok', 'ปกติ'];
                        return (
                            <tr key={t.table_name} className={a ? `row-${a.level}` : ''}>
                                <td><code>{t.table_name}</code></td>
                                <td className="small">{(t.kpis || []).map(n => <div key={n}>• {n}</div>)}</td>
                                <td className="text-center">
                                    <span className={`pill ${tone}`}>{label}</span>
                                    {a && a.type === 'stale' && <div className="small text-muted mt-1"><FiClock size={11} /> {a.days} วัน</div>}
                                </td>
                                <td className="num">{t.row_count.toLocaleString()}</td>
                                <td className="small">
                                    {t.synced_at ? (
                                        <>
                                            {fmtDate(t.synced_at)} โดย {t.synced_by || '-'}
                                            {t.status !== 'success' && t.error && <div className="text-danger">{t.error}</div>}
                                            {a && a.type === 'sync_failed' && a.last_success_at && (
                                                <div className="text-muted">สำเร็จล่าสุด {fmtDate(a.last_success_at)}</div>
                                            )}
                                        </>
                                    ) : <span className="text-muted">ยังไม่เคยซิงค์</span>}
                                    {a && a.type !== 'sync_failed' && <div className="text-muted">{alertText(a)}</div>}
                                </td>
                                <td className="text-center">
                                    <Button size="sm" variant={a ? 'primary' : 'outline-primary'} onClick={() => syncOne(t.table_name)} disabled={syncing[t.table_name] || syncAll}>
                                        {syncing[t.table_name] ? <Spinner size="sm" animation="border" /> : 'ซิงค์'}
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

export default AdminHdcPage;
