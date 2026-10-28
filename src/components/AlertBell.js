import { Dropdown } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';
import { FiAlertTriangle, FiBell, FiCheckCircle, FiClock, FiXCircle } from 'react-icons/fi';
import { alertText, useAlerts } from '../context/AlertsContext';
import { fmtDate } from '../utils/kpi';

const ICON = { sync_failed: FiXCircle, never_synced: FiAlertTriangle, stale: FiClock };

// กระดิ่งแจ้งเตือนใน topbar (เฉพาะ admin)
export default function AlertBell() {
    const { data, count } = useAlerts();
    if (!data) return null;
    const hasDanger = data.summary.sync_failed > 0;
    return (
        <Dropdown align="end">
            <Dropdown.Toggle as="button" className="icon-btn bell-btn" aria-label="การแจ้งเตือน" title="การแจ้งเตือนข้อมูล HDC">
                <FiBell size={18} />
                {count > 0 && <span className={`bell-badge ${hasDanger ? 'danger' : ''}`}>{count > 99 ? '99+' : count}</span>}
            </Dropdown.Toggle>
            <Dropdown.Menu className="alert-menu">
                <div className="alert-menu-head">
                    <b>การแจ้งเตือนข้อมูล HDC</b>
                    <small className="text-muted">ปี {data.year}</small>
                </div>
                {count === 0 ? (
                    <div className="alert-empty">
                        <FiCheckCircle size={22} />
                        <div>ข้อมูลทุกตารางเป็นปัจจุบัน</div>
                        <small className="text-muted">
                            {data.stale_days > 0 ? `อัปเดตภายใน ${data.stale_days} วัน` : 'ปิดการเตือนข้อมูลเก่าอยู่'} · {data.tables_total} ตาราง
                        </small>
                    </div>
                ) : (
                    <div className="alert-list">
                        {data.alerts.slice(0, 8).map(a => {
                            const Icon = ICON[a.type] || FiAlertTriangle;
                            return (
                                <Dropdown.Item as={NavLink} to="/admin/hdc" key={a.table_name} className={`alert-item ${a.level}`}>
                                    <span className="alert-ic"><Icon size={16} /></span>
                                    <span className="alert-body">
                                        <b>{a.table_name}</b> <span className="alert-what">{alertText(a)}</span>
                                        <small className="d-block text-truncate">{a.kpis.join(', ')}</small>
                                        {a.type === 'sync_failed' && <small className="d-block text-danger text-truncate">{a.error}</small>}
                                        {a.last_success_at && <small className="d-block">สำเร็จล่าสุด {fmtDate(a.last_success_at)}</small>}
                                    </span>
                                </Dropdown.Item>
                            );
                        })}
                    </div>
                )}
                <Dropdown.Divider />
                <Dropdown.Item as={NavLink} to="/admin/hdc" className="justify-content-center fw-semibold" style={{ color: 'var(--brand-600)' }}>
                    {count > 8 ? `ดูทั้งหมด ${count} รายการ` : 'ไปหน้าซิงค์ข้อมูล HDC'}
                </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
    );
}
