import { NavLink, useLocation } from 'react-router-dom';
import { Dropdown } from 'react-bootstrap';
import { FiCalendar, FiLogIn, FiLogOut, FiMenu, FiSettings, FiUser, FiList, FiDollarSign } from 'react-icons/fi';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';

const ADMIN_TITLES = {
    '/admin/kpis': 'จัดการตัวชี้วัด',
    '/admin/years': 'ปีงบประมาณ',
    '/admin/groups': 'กลุ่มตัวชี้วัด',
    '/admin/hdc': 'ซิงค์ข้อมูล HDC',
    '/admin/settings': 'ตั้งค่า / หน่วยบริการ',
    '/admin/users': 'ผู้ใช้งาน',
    '/admin/logs': 'บันทึกการใช้งาน',
    '/pp-fee-management': 'จัดการ PP Fee',
    '/profile-edit': 'ข้อมูลส่วนตัว',
    '/login': 'เข้าสู่ระบบ',
    '/signup': 'ลงทะเบียน',
};

// เส้นทางหน้าปัจจุบัน (breadcrumb)
function useCrumb() {
    const { pathname } = useLocation();
    const { groups } = useAppData();
    if (pathname === '/') return [null, 'หน้าหลัก'];
    const m = pathname.match(/^\/kpi\/([^/]+)(\/detail)?/);
    if (m) {
        const g = groups.find(x => x.slug === m[1]);
        const name = g ? g.name : 'ตัวชี้วัด';
        return m[2] ? [name, 'รายละเอียดตัวชี้วัด'] : ['หน้าหลัก', name];
    }
    if (pathname.startsWith('/pp-fee/')) return ['PP Fee Schedule', `ปีงบประมาณ ${pathname.split('/')[2]}`];
    if (ADMIN_TITLES[pathname]) return [pathname.startsWith('/admin') ? 'ผู้ดูแลระบบ' : null, ADMIN_TITLES[pathname]];
    return [null, ''];
}

function TopBar({ onMenu }) {
    const { user, isAdmin } = useAuth();
    const { years, year, setYear } = useAppData();
    const [parent, current] = useCrumb();

    const handleLogout = async () => {
        try {
            await api.get('/logout');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            window.location.href = '/';
        }
    };

    const fullName = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : '';
    const initial = user ? (user.first_name || user.username || '?').trim().charAt(0).toUpperCase() : '';

    return (
        <header className="tb">
            <div className="tb-left">
                <button className="icon-btn tb-burger" onClick={onMenu} aria-label="เมนู"><FiMenu size={18} /></button>
                <div className="tb-crumb">
                    {parent && <>{parent} / </>}<b>{current}</b>
                </div>
            </div>
            <div className="tb-right">
                {years.length > 0 && (
                    <label className="year-select mb-0" title="เลือกปีงบประมาณที่จะดู">
                        <FiCalendar size={16} />
                        <span className="lbl">ปีงบประมาณ</span>
                        <select aria-label="เลือกปีงบประมาณ" value={year || ''} onChange={e => setYear(e.target.value)}>
                            {years.map(y => <option key={y.year} value={y.year}>{y.year}</option>)}
                        </select>
                    </label>
                )}

                {user ? (
                    <Dropdown align="end">
                        <Dropdown.Toggle className="avatar-btn" id="dropdown-user">
                            <span className="avatar">{initial}</span>
                            <span className="who">
                                <b>{user.username}</b>
                                <small>{isAdmin ? 'ผู้ดูแลระบบ' : (fullName || 'ผู้ใช้')}</small>
                            </span>
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item as={NavLink} to="/profile-edit"><FiUser /> ข้อมูลส่วนตัว</Dropdown.Item>
                            {isAdmin && (
                                <>
                                    <Dropdown.Item as={NavLink} to="/admin/kpis"><FiList /> จัดการตัวชี้วัด</Dropdown.Item>
                                    <Dropdown.Item as={NavLink} to="/admin/settings"><FiSettings /> ตั้งค่าระบบ</Dropdown.Item>
                                    <Dropdown.Item as={NavLink} to="/pp-fee-management"><FiDollarSign /> จัดการ PP Fee</Dropdown.Item>
                                </>
                            )}
                            <Dropdown.Divider />
                            <Dropdown.Item onClick={handleLogout}><FiLogOut /> ออกจากระบบ</Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                ) : (
                    <NavLink to="/login" className="btn btn-primary btn-icon"><FiLogIn /> เข้าสู่ระบบ</NavLink>
                )}
            </div>
        </header>
    );
}

export default TopBar;
