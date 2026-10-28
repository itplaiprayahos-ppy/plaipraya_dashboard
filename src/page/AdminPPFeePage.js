import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Button, Col, Container, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { FaEdit, FaPlus, FaRegTrashAlt } from "react-icons/fa";

function AdminPPFeePage() {
    const [loading, setLoading] = useState(false);
    const [years, setYears] = useState([]);
    const [newYear, setNewYear] = useState('');
    const [status, setStatus] = useState('inactive');
    const [hoverLogin, setHoverLogin] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [selectedYear, setSelectedYear] = useState(null);
    const [yearData, setYearData] = useState([]);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [deleteItem, setDeleteItem] = useState(null);


    const [showAddModal, setShowAddModal] = useState(false);
    const [newData, setNewData] = useState({
        service_unit_code: '',
        service_unit_name: '',
        main_activity: '',
        sub_activity: '',
        person_count: 0,
        service_count: 0,
        amount: 0
    });

    const handleOpenAddForm = () => {
        setShowModal(false)
        setShowAddModal(true)
    }

    const handleCloseAddForm = () => {
        setShowAddModal(false)
        setShowModal(true)
    }

    const handleEdit = (item) => {
        setEditItem({ ...item });
        setShowEditModal(true);
    };


    useEffect(() => {
        fetchYears();
    }, []);

    const fetchYears = async () => {
        const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/ppfee/years`);
        setYears(res.data);
    };

    const handleAddYear = async () => {
        if (!newYear) return;
        try {
            const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/ppfee/years`, {
                year: newYear,
                status: status
            },
                { withCredentials: true });
            setNewYear('');
            setStatus('inactive');
            fetchYears();
            if (res.data.success) {
                Swal.fire({
                    icon: "success",
                    title: "เพิ่มปีงบประมาณเสร็จสิ้น",
                    showConfirmButton: false,
                    timer: 1500
                })
            }
        } catch (err) {
            if (err.response && err.response.status === 400) {
                Swal.fire({
                    icon: "error",
                    title: "เกิดข้อผิดพลาด",
                    text: err.response.data.message,
                });
            }
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        await axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/ppfee/years/${id}`, { status: newStatus });
        fetchYears();
    };

    const handleOpenModal = async (year) => {
        setSelectedYear(year);
        setShowModal(true);

        try {
            const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/ppfee/data/${year.id}`);
            setYearData(res.data);
        } catch (err) {
            console.error(err);
        }
    };


    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedYear(null);
        setYearData([]);
    };

    const changepage = (path) => {
        window.location.href = "/" + path
    }

    const handleAddData = async () => {
        if (!selectedYear) return;

        try {
            const res = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/ppfee/data/${selectedYear.id}`,
                newData
            );

            if (res.data.success) {
                Swal.fire({
                    icon: "success",
                    title: "เพิ่มข้อมูลสำเร็จ",
                    timer: 1500,
                    showConfirmButton: false,
                });

                setShowModal(false)
                setShowAddModal(false);
                setNewData({
                    service_unit_code: '',
                    service_unit_name: '',
                    main_activity: '',
                    sub_activity: '',
                    person_count: 0,
                    service_count: 0,
                    amount: 0
                });

                const updated = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/ppfee/data/${selectedYear.id}`);
                setYearData(updated.data);
                setShowModal(true)
            }
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "เกิดข้อผิดพลาด",
                text: error.response?.data?.message || "ไม่สามารถเพิ่มข้อมูลได้",
            });
        }
    };

    const handleUpdate = async () => {
        try {
            const res = await axios.put(
                `${process.env.REACT_APP_BACKEND_URL}/api/ppfee/data/${editItem.id}`,
                editItem
            );

            if (res.data.success) {
                Swal.fire({
                    icon: "success",
                    title: "แก้ไขข้อมูลสำเร็จ",
                    showConfirmButton: false,
                    timer: 1500,
                });

                setShowEditModal(false);

                const updated = await axios.get(
                    `${process.env.REACT_APP_BACKEND_URL}/api/ppfee/data/${selectedYear.id}`
                );
                setYearData(updated.data);
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: "error",
                title: "เกิดข้อผิดพลาด",
                text: err.response?.data?.message || "ไม่สามารถแก้ไขข้อมูลได้",
            });
        }
    };


    const groupedData = yearData.reduce((acc, curr) => {
        // ใช้ key รวมกันของหน่วยบริการและกิจกรรมหลัก
        const key = `${curr.service_unit_code}-${curr.service_unit_name}-${curr.main_activity}`;

        if (!acc[key]) {
            acc[key] = {
                service_unit_code: curr.service_unit_code,
                service_unit_name: curr.service_unit_name,
                main_activity: curr.main_activity,
                sub_activities: [],
            };
        }

        acc[key].sub_activities.push({
            id: curr.id,
            sub_activity: curr.sub_activity,
            person_count: curr.person_count,
            service_count: curr.service_count,
            amount: curr.amount,
        });

        return acc;
    }, {});

    const rows = Object.values(groupedData);


    const handleOpenConfirmDelete = (item) => {
        setDeleteItem({ ...item });
        setShowConfirm(true);
    };

    const handleDelete = async () => {
        try {
            setLoading(true);

            // เรียก API เพื่อลบข้อมูล
            const res = await axios.delete(
                `${process.env.REACT_APP_BACKEND_URL}/api/ppfee/data/${deleteItem.id}`
            );

            if (res.data.success) {
                Swal.fire({
                    icon: "success",
                    title: "ลบข้อมูลสำเร็จ",
                    showConfirmButton: false,
                    timer: 1500,
                });

                setShowConfirm(false);

                const updated = await axios.get(
                    `${process.env.REACT_APP_BACKEND_URL}/api/ppfee/data/${selectedYear.id}`
                );
                setYearData(updated.data);
            } else {
                Swal.fire({
                    icon: "error",
                    title: "เกิดข้อผิดพลาด",
                    text: res.data.message || "ไม่สามารถลบข้อมูลได้",
                });
            }
        } catch (error) {
            console.error("Error deleting data:", error);
            Swal.fire({
                icon: "error",
                title: "เกิดข้อผิดพลาด",
                text: error.response?.data?.message || "ไม่สามารถลบข้อมูลได้",
            });
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        const loading = async () => {
            setLoading(true)
            setTimeout(() => {
                setLoading(false);
            }, 500);

        };

        loading();
    }, []);


    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checkAuth`, {
                    withCredentials: true
                });

                if (res.data.loggedIn && res.data.username) {

                    if (res.data.role !== "admin") {
                        changepage('');
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
            <Container fluid className="h-100">
                <div className="container mt-4">
                    <h2>จัดการปีงบประมาณ (PpFeeSchedule)</h2>
                    <Row className="gy-2 gx-2 align-items-center mt-4">
                        <Col xs={12} sm={4} md={5}>
                            <input
                                type="text"
                                placeholder="เช่น 2568"
                                value={newYear}
                                onChange={(e) => setNewYear(e.target.value)}
                                className="form-control"
                            />
                        </Col>

                        <Col xs={12} sm={4} md={5}>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="form-select"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </Col>

                        <Col xs={12} sm={4} md={2}>
                            <button className="btn btn-primary w-100" onClick={handleAddYear}
                                style={{
                                    backgroundColor: hoverLogin ? "#0d7c73ff" : "#0d9488", color: "#ffffff",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "6px 12px"
                                }}
                                onMouseEnter={() => setHoverLogin(true)}
                                onMouseLeave={() => setHoverLogin(false)}>
                                เพิ่มปีงบประมาณ
                            </button>
                        </Col>
                    </Row>

                    <table className="table table-hover align-middle mt-5 shadow-sm rounded">
                        <thead className="table-primary">
                            <tr>
                                <th style={{ width: '20%', backgroundColor: '#0d9488', color: '#fff', textAlign: 'center' }}>ปีงบประมาณ</th>
                                <th style={{ width: '20%', backgroundColor: '#0d9488', color: '#fff', textAlign: 'center' }}>เปลี่ยนสถานะ</th>
                                <th style={{ width: '40%', backgroundColor: '#0d9488', color: '#fff', textAlign: 'center' }}>จัดการ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {years.map((item) => (
                                <tr key={item.id}>
                                    {/* ปีงบประมาณ */}
                                    <td className="text-center fw-bold">{item.year}</td>

                                    {/* ปุ่มเปลี่ยนสถานะ */}
                                    <td className="text-center">
                                        <Button
                                            className={`btn btn-sm ${item.status === 'active' ? 'btn-success' : 'btn-secondary'
                                                } px-3 py-1`}
                                            onClick={() => handleToggleStatus(item.id, item.status)}
                                        >
                                            {item.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                        </Button>
                                    </td>

                                    {/* ปุ่มจัดการข้อมูล */}
                                    <td className="text-center">
                                        <Button
                                            variant="outline-primary"
                                            onClick={() => handleOpenModal(item)}
                                            style={{
                                                color: '#0d9488',
                                                borderColor: '#0d9488',
                                                backgroundColor: 'transparent',
                                                borderRadius: '8px',
                                                padding: '8px 16px',
                                                fontWeight: 500,
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#0d9488';
                                                e.currentTarget.style.color = 'white';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = '#0d9488';
                                            }}
                                        >
                                            จัดการข้อมูล
                                        </Button>


                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                </div>

                {/* Modal จัดการข้อมูล */}
                <Modal
                    show={showModal}
                    onHide={handleCloseModal}
                    size="xl"
                    backdrop="static"
                >
                    <Modal.Header closeButton>
                        <Modal.Title>จัดการข้อมูลกิจกรรม ปีงบ {selectedYear?.year}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="d-flex justify-content-end mb-3">
                            <Button variant="success" onClick={handleOpenAddForm}>
                                <FaPlus /> เพิ่มข้อมูล
                            </Button>
                        </div>


                        {Object.keys(
                            yearData.reduce((acc, cur) => {
                                if (!acc[cur.service_name]) acc[cur.service_name] = {};
                                if (!acc[cur.service_name][cur.main_activity]) acc[cur.service_name][cur.main_activity] = [];
                                acc[cur.service_name][cur.main_activity].push(cur);
                                return acc;
                            }, {})
                        ).length === 0 ? (
                            <div className="text-center text-muted">ไม่มีข้อมูลในปีนี้</div>
                        ) : (
                            <Table bordered hover responsive className="mt-3">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ textAlign: 'center', backgroundColor: '#0d9488', color: '#fff' }}>หน่วยที่ให้บริการ</th>
                                        <th style={{ textAlign: 'center', backgroundColor: '#0d9488', color: '#fff' }}>ชื่อของหน่วยให้บริการ</th>
                                        <th style={{ textAlign: 'center', backgroundColor: '#0d9488', color: '#fff' }}>กิจกรรมหลัก</th>
                                        <th style={{ textAlign: 'center', backgroundColor: '#0d9488', color: '#fff' }}>กิจกรรมย่อย</th>
                                        <th style={{ textAlign: 'center', backgroundColor: '#0d9488', color: '#fff' }}>รับบริการ (คน)</th>
                                        <th style={{ textAlign: 'center', backgroundColor: '#0d9488', color: '#fff' }}>จำนวนครั้ง</th>
                                        <th style={{ textAlign: 'center', backgroundColor: '#0d9488', color: '#fff' }}>การเบิกจ่าย</th>
                                        <th style={{ textAlign: 'center', backgroundColor: '#0d9488', color: '#fff' }}>จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((group, idx) =>
                                        group.sub_activities.map((sub, i) => (
                                            <tr key={`${idx}-${i}`} className="align-middle">
                                                {i === 0 && (
                                                    <>
                                                        <td rowSpan={group.sub_activities.length} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                            {group.service_unit_code}
                                                        </td>
                                                        <td rowSpan={group.sub_activities.length} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                            {group.service_unit_name}
                                                        </td>
                                                        <td rowSpan={group.sub_activities.length} style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                                            {group.main_activity}
                                                        </td>
                                                    </>
                                                )}
                                                <td>{sub.sub_activity}</td>
                                                <td style={{ textAlign: 'center' }}>{sub.person_count}</td>
                                                <td style={{ textAlign: 'center' }}>{sub.service_count}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {Number(sub.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-center" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.275rem' }}>
                                                    <Button variant="outline-warning" size="sm" className="me-1"
                                                        onClick={() => handleEdit(sub)}><FaEdit /></Button>
                                                    <Button variant="outline-danger" size="sm"
                                                        onClick={() => handleOpenConfirmDelete(sub)}
                                                    ><FaRegTrashAlt /></Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </Table>

                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseModal}>
                            ปิด
                        </Button>
                    </Modal.Footer>
                </Modal>

                <Modal show={showAddModal} onHide={handleCloseAddForm}>
                    <Modal.Header closeButton>
                        <Modal.Title>เพิ่มข้อมูลกิจกรรม</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="mb-2">
                            <label>หน่วยที่ให้บริการ</label>
                            <input
                                type="text"
                                className="form-control"
                                value={newData.service_unit_code}
                                onChange={(e) => setNewData({ ...newData, service_unit_code: e.target.value })}
                            />
                        </div>
                        <div className="mb-2">
                            <label>ชื่อหน่วยบริการ</label>
                            <input
                                type="text"
                                className="form-control"
                                value={newData.service_unit_name}
                                onChange={(e) => setNewData({ ...newData, service_unit_name: e.target.value })}
                            />
                        </div>
                        <div className="mb-2">
                            <label>กิจกรรมหลัก</label>
                            <input
                                type="text"
                                className="form-control"
                                value={newData.main_activity}
                                onChange={(e) => setNewData({ ...newData, main_activity: e.target.value })}
                            />
                        </div>
                        <div className="mb-2">
                            <label>กิจกรรมย่อย</label>
                            <input
                                type="text"
                                className="form-control"
                                value={newData.sub_activity}
                                onChange={(e) => setNewData({ ...newData, sub_activity: e.target.value })}
                            />
                        </div>
                        <div className="mb-2">
                            <label>รับบริการ (คน)</label>
                            <input
                                type="number"
                                className="form-control"
                                value={newData.person_count}
                                onChange={(e) => setNewData({ ...newData, person_count: e.target.value })}
                            />
                        </div>
                        <div className="mb-2">
                            <label>จำนวนครั้ง</label>
                            <input
                                type="number"
                                className="form-control"
                                value={newData.service_count}
                                onChange={(e) => setNewData({ ...newData, service_count: e.target.value })}
                            />
                        </div>
                        <div className="mb-2">
                            <label>การเบิกจ่าย</label>
                            <input
                                type="number"
                                className="form-control"
                                value={newData.amount}
                                onChange={(e) => setNewData({ ...newData, amount: e.target.value })}
                            />
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                            ยกเลิก
                        </Button>
                        <Button variant="primary" onClick={handleAddData}
                            style={{
                                backgroundColor: hoverLogin ? "#0d7c73ff" : "#0d9488", color: "#ffffff",
                                border: "none",
                                borderRadius: "8px",
                                padding: "6px 12px"
                            }}>
                            บันทึก
                        </Button>
                    </Modal.Footer>
                </Modal>


                {/*Modal แก้ไข */}
                <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
                    <Modal.Header closeButton>
                        <Modal.Title>แก้ไขข้อมูลกิจกรรมย่อย</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {editItem && (
                            <Form>
                                <Form.Group className="mb-2">
                                    <Form.Label>กิจกรรมย่อย</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editItem.sub_activity}
                                        onChange={(e) =>
                                            setEditItem({ ...editItem, sub_activity: e.target.value })
                                        }
                                    />
                                </Form.Group>

                                <Form.Group className="mb-2">
                                    <Form.Label>รับบริการ (คน)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={editItem.person_count}
                                        onChange={(e) =>
                                            setEditItem({ ...editItem, person_count: Number(e.target.value) })
                                        }
                                    />
                                </Form.Group>

                                <Form.Group className="mb-2">
                                    <Form.Label>จำนวนครั้ง</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={editItem.service_count}
                                        onChange={(e) =>
                                            setEditItem({ ...editItem, service_count: Number(e.target.value) })
                                        }
                                    />
                                </Form.Group>

                                <Form.Group className="mb-2">
                                    <Form.Label>การเบิกจ่าย</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={editItem.amount}
                                        onChange={(e) =>
                                            setEditItem({ ...editItem, amount: Number(e.target.value) })
                                        }
                                    />
                                </Form.Group>
                            </Form>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                            ยกเลิก
                        </Button>
                        <Button variant="primary" onClick={handleUpdate} style={{
                            backgroundColor: hoverLogin ? "#0d7c73ff" : "#0d9488", color: "#ffffff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "6px 12px"
                        }}>
                            บันทึก
                        </Button>
                    </Modal.Footer>
                </Modal>


                {/* Modal ยืนยันการลบ */}
                <Modal
                    show={showConfirm}
                    onHide={() => setShowConfirm(false)}
                    centered
                >
                    <Modal.Header closeButton>
                        <Modal.Title>ยืนยันการลบ</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p>คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?</p>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowConfirm(false)}>
                            ยกเลิก
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            disabled={loading}
                        >
                            {loading ? "กำลังลบ..." : "ลบข้อมูล"}
                        </Button>
                    </Modal.Footer>
                </Modal>

            </Container>
        )
    )
}

export default AdminPPFeePage