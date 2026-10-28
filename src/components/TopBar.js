import {
    CDBNavbar,
    CDBNavbarNav,
    CDBNavItem,
} from 'cdbreact';
import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import { Dropdown, Form } from 'react-bootstrap';
import { FaSignOutAlt, FaUser, FaUserCog } from 'react-icons/fa';

function TopBar() {
    const { user } = useAuth();
    const { years, year, setYear } = useAppData();
    const username = user ? user.username : null;
    const role = user ? user.role : null;
    const [hoverLogin, setHoverLogin] = useState(false);

    const bgBlack = { backgroundColor: '#f0f1f3', color: '#2A2F5B' };

    const changepage = (path) => {
        window.location.href = "/" + path
    }

    const handleLogout = async () => {
        try {
            await api.get('/logout');
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            changepage('')
        }
    };

    return (
        <div style={{ maxHeight: "73.5px", }}>
            <CDBNavbar style={bgBlack} dark expand="md">
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '10px 32px' }}>
                    <CDBNavbarNav right style={{ marginLeft: 'auto', alignItems: 'center' }}>
                        {years.length > 0 && (
                            <CDBNavItem>
                                <div className="d-flex align-items-center me-3" style={{ color: '#2A2F5B' }}>
                                    <span className="me-2 text-nowrap" style={{ fontWeight: 500 }}>ปีงบประมาณ</span>
                                    <Form.Select
                                        size="sm"
                                        aria-label="เลือกปีงบประมาณ"
                                        value={year || ''}
                                        onChange={e => setYear(e.target.value)}
                                        style={{ width: 100, borderColor: '#0d9488' }}
                                    >
                                        {years.map(y => <option key={y.year} value={y.year}>{y.year}</option>)}
                                    </Form.Select>
                                </div>
                            </CDBNavItem>
                        )}
                        <CDBNavItem>
                            {username ? (
                                <Dropdown align="end">
                                    <Dropdown.Toggle
                                        variant="outline-light"
                                        id="dropdown-user"
                                        style={{
                                            backgroundColor: hoverLogin ? "#0d7c73ff" : "#0d9488",
                                            color: "#ffffff",
                                            border: "none",
                                            borderRadius: "8px",
                                            padding: "6px 12px"
                                        }}
                                    >
                                        {username}
                                    </Dropdown.Toggle>

                                    <Dropdown.Menu
                                        style={{
                                            backgroundColor: "#ffffff",
                                            borderRadius: "8px",
                                            border: 'none'
                                        }}
                                    >
                                        <Dropdown.Item
                                            onClick={() => changepage('profile-edit')}
                                            style={{
                                                color: "#2C3B50",
                                                fontWeight: "500",
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}

                                        >
                                            <FaUser size={16} style={{ marginRight: '0.5rem' }} /> ข้อมูลส่วนตัว
                                        </Dropdown.Item>
                                        {role === "admin" && (
                                            <>
                                                {[
                                                    ['admin/kpis', 'จัดการตัวชี้วัด'],
                                                    ['admin/settings', 'ตั้งค่าระบบ'],
                                                    ['pp-fee-management', 'จัดการ PP Fee'],
                                                ].map(([path, label]) => (
                                                    <Dropdown.Item
                                                        key={path}
                                                        onClick={() => changepage(path)}
                                                        style={{ color: "#2C3B50", fontWeight: "500", display: 'flex', alignItems: 'center' }}
                                                    >
                                                        <FaUserCog size={16} style={{ marginRight: '0.5rem' }} /> {label}
                                                    </Dropdown.Item>
                                                ))}
                                            </>
                                        )}

                                        <Dropdown.Item
                                            onClick={handleLogout}
                                            style={{
                                                color: "#2C3B50",
                                                fontWeight: "500",
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <FaSignOutAlt size={16} style={{ marginRight: '0.5rem' }} /> ออกจากระบบ
                                        </Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>

                            ) : (
                                <NavLink
                                    to="/login"
                                    className="btn"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        backgroundColor: hoverLogin ? "#0d7c73ff" : "#0d9488",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "6px 14px",
                                        fontWeight: "500"
                                    }}
                                    onMouseEnter={() => setHoverLogin(true)}
                                    onMouseLeave={() => setHoverLogin(false)}
                                >
                                    <i className="fa fa-sign-in-alt" aria-hidden="true" />
                                    เข้าสู่ระบบ
                                </NavLink>

                            )}
                        </CDBNavItem>
                    </CDBNavbarNav>
                </div>
            </CDBNavbar>
        </div>
    )
}

export default TopBar;
