import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FiHome, FiFileText, FiPercent, FiSettings } from 'react-icons/fi';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';

const ADMIN_LINKS = [
    ['/admin/kpis', 'จัดการตัวชี้วัด'],
    ['/admin/years', 'ปีงบประมาณ'],
    ['/admin/groups', 'กลุ่มตัวชี้วัด'],
    ['/admin/hdc', 'ซิงค์ข้อมูล HDC'],
    ['/admin/settings', 'ตั้งค่า / หน่วยบริการ'],
    ['/admin/users', 'ผู้ใช้งาน'],
    ['/admin/logs', 'บันทึกการใช้งาน'],
    ['/pp-fee-management', 'จัดการ PP Fee'],
];

const cls = (extra = '') => ({ isActive }) => `sb-link ${extra} ${isActive ? 'active' : ''}`;

function SideBar({ onNavigate }) {
    const [years, setYears] = useState([]);
    const { isAdmin } = useAuth();
    const { groups, settings } = useAppData();

    useEffect(() => {
        api.get('/ppfee/years')
            .then(res => setYears(Array.isArray(res.data) ? res.data : []))
            .catch(err => console.error('Error fetching years:', err));
    }, []);

    const activeYears = years.filter(y => y.status === 'active');

    return (
        <aside className="sb" onClick={(e) => { if (e.target.closest('a')) onNavigate && onNavigate(); }}>
            <NavLink to="/" className="sb-brand">
                <span className="sb-logo"><FiPercent size={20} strokeWidth={2.4} /></span>
                <span>
                    <b>{settings.site_name || 'KPI Dashboard'}</b>
                    <small>โรงพยาบาลปลายพระยา</small>
                </span>
            </NavLink>

            <NavLink to="/" end className={cls()}>
                <span className="sb-ic"><FiHome size={18} /></span>หน้าหลัก
            </NavLink>

            {groups.map(g => (
                <NavLink key={g.id} to={`/kpi/${g.slug}`} className={cls()}>
                    <span className="sb-ic"><i className={`fa fa-${g.icon || 'chart-bar'}`} /></span>
                    <span className="text-truncate">{g.name}</span>
                </NavLink>
            ))}

            {activeYears.length > 0 && (
                <>
                    <div className="sb-section">PP Fee Schedule</div>
                    {activeYears.map(item => (
                        <NavLink key={item.id} to={`/pp-fee/${item.year}`} className={cls()}>
                            <span className="sb-ic"><FiFileText size={18} /></span>ปีงบประมาณ {item.year}
                        </NavLink>
                    ))}
                </>
            )}

            {isAdmin && (
                <>
                    <div className="sb-section"><FiSettings size={11} className="me-1" />ผู้ดูแลระบบ</div>
                    {ADMIN_LINKS.map(([to, label]) => (
                        <NavLink key={to} to={to} className={cls('sub')}>{label}</NavLink>
                    ))}
                </>
            )}
        </aside>
    );
}

export default SideBar;
