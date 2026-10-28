import axios from "axios";
import { useEffect } from "react";
import { Container, Row, Col, Card } from "react-bootstrap";
import { FaMoneyCheckAlt, FaUsersCog } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

function AdminManagementPage() {
    const navigate = useNavigate();

    const menuItems = [
        {
            title: "จัดการ Pp Fee Schedule",
            desc: "เพิ่ม/แก้ไขปีงบประมาณ และข้อมูลการให้บริการ",
            icon: <FaMoneyCheckAlt size={40} color="#0d9488" />,
            path: "/pp-fee-management"
        },
        {
            title: "จัดการผู้ใช้งาน",
            desc: "จัดการผู้ใช้ กำหนดสิทธิ์ และข้อมูลระบบ",
            icon: <FaUsersCog size={40} color="#2563eb" />,
            path: "/admin/user-management"
        }
    ];

    const changepage = (path) => {
        window.location.href = "/" + path
    }

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
        <Container className="mt-5">
            <h2 className="fw-bold mb-4">ศูนย์ควบคุมสำหรับผู้ดูแลระบบ</h2>
            <p className="text-muted mb-4">เลือกเมนูด้านล่างเพื่อจัดการข้อมูลแต่ละส่วนของระบบ</p>

            <Row>
                {menuItems.map((item, index) => (
                    <Col key={index} xs={12} md={6} lg={4} className="mb-4">
                        <Card
                            className="shadow-sm border-0 admin-card"
                            style={{ cursor: "pointer", borderRadius: "15px" }}
                            onClick={() => navigate(item.path)}
                        >
                            <Card.Body className="text-center">
                                <div className="mb-3">{item.icon}</div>
                                <h5 className="fw-bold">{item.title}</h5>
                                <p className="text-muted">{item.desc}</p>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        </Container>
    );
}

export default AdminManagementPage;
