import React, { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Spinner } from "react-bootstrap";
import axios from "axios";
import Swal from "sweetalert2";
import { FaEdit } from "react-icons/fa";

function UserManagementPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const [showEditModal, setShowEditModal] = useState(false);
    const [editUser, setEditUser] = useState(null);

    const department_list = ["ควบคุมโรคติดต่อ (IDC)", "ควบคุมโรคไม่ติดต่อ (NCD)", "ควบคุมผู้บริโภค (CPC)", "ทรัพยากรบุคคล (HRM)", "ทันตสาธารณสุข (DEN)",
        "นิติการ (LEG)", "บริหารทั่วไป (ADM)", "ปฐมภูมิและเครือข่ายสุขภาพ (PRI)", "ประกันสุขภาพ (HIN)", "พัฒนาคุณภาพบริหาร (QIS)", "ยุทธศาสตร์สาธารณสุข (PHS)",
        "สุขภาพดิจิทัล (DGH)", "ส่งเสริมสุขภาพ (HPR)", "อนามัยสิ่งแวดล้อม (ENV)", "แพทย์แผนไทย (TMD)", "อื่นๆ (OTH)"
    ]

    useEffect(() => {
        fetchUsers();
    }, []);

    const changepage = (path) => {
        window.location.href = "/" + path
    }

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/users`, {
                withCredentials: true
            });
            setUsers(res.data);
        } catch (err) {
            console.error(err);
            Swal.fire("Error", "ไม่สามารถโหลดข้อมูลผู้ใช้ได้", "error");
        } finally {
            setTimeout(() => {
                setLoading(false);
            }, 500);
        }
    };


    const handleEdit = (user) => {
        setEditUser({ ...user });
        setShowEditModal(true);
    };

    const handleUpdate = async () => {
        try {
            await axios.put(
                `${process.env.REACT_APP_BACKEND_URL}/api/users/${editUser.id}`,
                editUser,
                {
                    withCredentials: true
                }
            );

            Swal.fire({
                icon: "success",
                title: "อัปเดตสำเร็จ",
                timer: 1500,
                showConfirmButton: false,
            });

            setShowEditModal(false);
            fetchUsers();
        } catch (err) {
            console.error(err);
            Swal.fire("Error", "อัปเดตข้อมูลไม่สำเร็จ", "error");
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checkAuth`, {
                    withCredentials: true
                });

                if (res.data.loggedIn && res.data.username) {

                    if (res.data.role !== "superadmin") {
                        changepage('')
                    }
                } else {
                    changepage('login')
                }

            } catch (error) {
                if (error.response && error.response.status === 401) {
                    changepage('login')
                } else {
                    console.error("Auth check failed:", error);
                }
            }
        };

        checkAuth();
    }, []);

    return (
        loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
                <Spinner animation="border" role="status" size='lg'>
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        ) : (
            <div className="container mt-4">
                <h2 className="mb-4">จัดการผู้ใช้ระบบ (User Management)</h2>

                <Table striped bordered hover responsive>
                    <thead className="table-primary text-center custom-thead">
                        <tr>
                            <th style={{ backgroundColor: '#0d9488', color: '#fff', textAlign: 'center' }}>ชื่อ</th>
                            <th style={{ backgroundColor: '#0d9488', color: '#fff', textAlign: 'center' }}>นามสกุล</th>
                            <th style={{ backgroundColor: '#0d9488', color: '#fff', textAlign: 'center' }}>กลุ่มงาน</th>
                            <th style={{ backgroundColor: '#0d9488', color: '#fff', textAlign: 'center' }}>สิทธิ์การใช้งาน</th>
                            <th style={{ backgroundColor: '#0d9488', color: '#fff', textAlign: 'center' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="text-center">{user.first_name}</td>
                                <td className="text-center">{user.last_name}</td>
                                <td className="text-center">{user.department}</td>
                                <td className="text-center">
                                    <span className={`badge ${user.role === "admin" ? "bg-danger" : "bg-primary"}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="text-center">
                                    <Button
                                        variant="outline-warning"
                                        size="sm"
                                        className="d-inline-flex align-items-center justify-content-center"
                                        style={{
                                            gap: "6px",
                                            padding: "4px 10px",
                                            borderRadius: "8px",
                                            fontWeight: "500"
                                        }}
                                        onClick={() => handleEdit(user)}
                                    >
                                        <FaEdit size={16} />
                                        แก้ไข
                                    </Button>
                                </td>

                            </tr>
                        ))}
                    </tbody>
                </Table>

                {/* Modal แก้ไขข้อมูล */}
                <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
                    <Modal.Header closeButton>
                        <Modal.Title>แก้ไขข้อมูลผู้ใช้</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {editUser && (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label>ชื่อ</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editUser.first_name}
                                        onChange={(e) =>
                                            setEditUser({ ...editUser, first_name: e.target.value })
                                        }
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>นามสกุล</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editUser.last_name}
                                        onChange={(e) =>
                                            setEditUser({ ...editUser, last_name: e.target.value })
                                        }
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>กลุ่มงาน</Form.Label>
                                    <Form.Select
                                        name="department"
                                        value={editUser.department}
                                        onChange={(e) =>
                                            setEditUser({ ...editUser, department: e.target.value })
                                        }
                                        required
                                    >
                                        <option value="">กลุ่มงาน</option>
                                        {department_list.map((data, index) => (
                                            <option key={index} value={data}>
                                                {data}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>สิทธิ์การใช้งาน (Role)</Form.Label>
                                    <Form.Select
                                        value={editUser.role}
                                        onChange={(e) =>
                                            setEditUser({ ...editUser, role: e.target.value })
                                        }
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </Form.Select>
                                </Form.Group>
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                            ยกเลิก
                        </Button>
                        <Button variant="primary" onClick={handleUpdate}>
                            บันทึก
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    );
}

export default UserManagementPage;
