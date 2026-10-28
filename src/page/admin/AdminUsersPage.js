import { useCallback, useEffect, useState } from 'react';
import { Button, Form, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FullPageLoading } from '../../components/Loading';
import { fmtDate } from '../../utils/kpi';

const TH = { verticalAlign: 'middle' };
const ROLES = [
    { value: 'user', label: 'ผู้ใช้ (ดูอย่างเดียว)' },
    { value: 'admin', label: 'ผู้ดูแลระบบ (ตั้งค่า/ซิงค์/กรอกข้อมูล)' },
];

function AdminUsersPage() {
    const { user: me } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState(null);

    const load = useCallback(async () => {
        try {
            const res = await api.get('/admin/users');
            setUsers(res.data);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: errMsg(err) });
            setUsers([]);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const changeRole = async (u, role) => {
        try {
            await api.put(`/admin/users/${u.id}/role`, { role });
            load();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'เปลี่ยนสิทธิ์ไม่สำเร็จ', text: errMsg(err) });
        }
    };

    const resetPassword = async (u) => {
        const r = await Swal.fire({
            title: `ตั้งรหัสผ่านใหม่ให้ ${u.username}`,
            input: 'password', inputPlaceholder: 'รหัสผ่านใหม่ อย่างน้อย 8 ตัวอักษร',
            inputAttributes: { autocomplete: 'new-password' },
            showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
            preConfirm: (v) => (v && v.length >= 8 ? v : (Swal.showValidationMessage('อย่างน้อย 8 ตัวอักษร'), false)),
        });
        if (!r.isConfirmed) return;
        try {
            await api.put(`/admin/users/${u.id}/password`, { password: r.value });
            Swal.fire({ icon: 'success', title: 'ตั้งรหัสผ่านใหม่แล้ว', text: `แจ้งรหัสผ่านใหม่ให้ ${u.username} และแนะนำให้เปลี่ยนเองที่หน้าข้อมูลส่วนตัว` });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: errMsg(err) });
        }
    };

    const remove = async (u) => {
        const r = await Swal.fire({
            icon: 'warning', title: `ลบผู้ใช้ ${u.username}?`, showCancelButton: true,
            confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc3545',
        });
        if (!r.isConfirmed) return;
        try {
            await api.delete(`/admin/users/${u.id}`);
            load();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: errMsg(err) });
        }
    };

    if (!users) return <FullPageLoading />;

    return (
        <div className="page">
            <h1 className="page-title mb-3">ผู้ใช้งาน</h1>
            <p className="text-muted">
                <b>ผู้ใช้</b> ดูข้อมูลได้อย่างเดียว ไม่เห็นเมนูผู้ดูแลระบบ · <b>ผู้ดูแลระบบ</b> ตั้งค่า ซิงค์ HDC กรอกข้อมูล และจัดการผู้ใช้ได้
                — ผู้สมัครใหม่จะได้สิทธิ์ "ผู้ใช้" เสมอ ดูประวัติการใช้งานได้ที่เมนู "บันทึกการใช้งาน"
            </p>
            <div className="panel"><Table hover responsive className="table-modern">
                <thead>
                    <tr>
                        <th style={TH}>ชื่อผู้ใช้</th>
                        <th style={TH}>ชื่อ-สกุล</th>
                        <th style={TH}>อีเมล</th>
                        <th style={TH}>หน่วยงาน</th>
                        <th style={TH}>สมัครเมื่อ</th>
                        <th style={{ ...TH, width: 240 }}>สิทธิ์</th>
                        <th style={{ ...TH, width: 100 }}></th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(u => {
                        const isMe = me && String(me.id) === String(u.id);
                        return (
                            <tr key={u.id}>
                                <td>{u.username}{isMe && ' (คุณ)'}{' '}<Button size="sm" variant="link" className="p-0 ms-1" onClick={() => navigate(`/admin/logs?username=${encodeURIComponent(u.username)}`)} title="ดูบันทึกการใช้งาน"><i className="fa fa-history" /></Button></td>
                                <td>{[u.first_name, u.last_name].filter(Boolean).join(' ')}</td>
                                <td>{u.email}</td>
                                <td>{u.department}</td>
                                <td className="small">{fmtDate(u.created_at)}</td>
                                <td>
                                    <Form.Select size="sm" value={u.role || 'user'} disabled={isMe} onChange={e => changeRole(u, e.target.value)}>
                                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </Form.Select>
                                </td>
                                <td className="text-center text-nowrap">
                                    <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => resetPassword(u)} title="ตั้งรหัสผ่านใหม่"><i className="fa fa-key" /></Button>
                                    {!isMe && <Button size="sm" variant="outline-danger" onClick={() => remove(u)} title="ลบ"><i className="fa fa-trash" /></Button>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </Table></div>
        </div>
    );
}

export default AdminUsersPage;
