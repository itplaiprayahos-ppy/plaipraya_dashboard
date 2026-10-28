import {
    CDBSidebar,
    CDBSidebarHeader,
    CDBSidebarMenuItem,
    CDBSidebarContent,
    CDBSidebarMenu,
} from 'cdbreact';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
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

const linkClass = ({ isActive }) => `menu-link ${isActive ? 'active' : ''}`;

function SideBar() {
    const [years, setYears] = useState([]);
    const { isAdmin } = useAuth();
    const { groups, settings } = useAppData();

    useEffect(() => {
        api.get('/ppfee/years')
            .then(res => setYears(Array.isArray(res.data) ? res.data : []))
            .catch(err => console.error('Error fetching years:', err));
    }, []);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', overflow: 'scroll initial' }}>
            <CDBSidebar textColor="#fff" backgroundColor="#333">
                <CDBSidebarHeader prefix={<i className="fa fa-bars fa-large"></i>}>
                    <a href="/" className="text-decoration-none" style={{ color: 'inherit', marginRight: '15px' }}>
                        {settings.site_name || 'KPI Dashboard'}
                    </a>
                </CDBSidebarHeader>

                <CDBSidebarContent className="sidebar-content">
                    <CDBSidebarMenu>
                        <NavLink to="/" end className={linkClass}>
                            <CDBSidebarMenuItem icon="home">หน้าหลัก</CDBSidebarMenuItem>
                        </NavLink>

                        {/* กลุ่มตัวชี้วัดจากฐานข้อมูล */}
                        {groups.map(g => (
                            <NavLink key={g.id} to={`/kpi/${g.slug}`} className={linkClass}>
                                <CDBSidebarMenuItem icon={g.icon || 'chart-bar'}>{g.name}</CDBSidebarMenuItem>
                            </NavLink>
                        ))}

                        <CDBSidebarMenuItem icon="file-invoice-dollar">PP FEE SCHEDULE</CDBSidebarMenuItem>
                        {years.filter(item => item.status === 'active').map(item => (
                            <NavLink key={item.id} to={`/pp-fee/${item.year}`} className={linkClass}>
                                <CDBSidebarMenuItem style={{ paddingLeft: '35px' }}>{item.year}</CDBSidebarMenuItem>
                            </NavLink>
                        ))}

                        {/* CDBSidebarMenu clone ลูกทุกตัว จึงห้ามมีค่า false/null — ใช้ array แทน */}
                        {isAdmin ? [
                            <CDBSidebarMenuItem key="admin-title" icon="cogs">ผู้ดูแลระบบ</CDBSidebarMenuItem>,
                            ...ADMIN_LINKS.map(([to, label]) => (
                                <NavLink key={to} to={to} className={linkClass}>
                                    <CDBSidebarMenuItem style={{ paddingLeft: '35px' }}>{label}</CDBSidebarMenuItem>
                                </NavLink>
                            )),
                        ] : []}
                    </CDBSidebarMenu>
                </CDBSidebarContent>
            </CDBSidebar>
        </div>
    );
}

export default SideBar;
