import React, { useEffect, useState } from 'react';
import { Form, Button, Card, Container, Row, Col, Spinner } from 'react-bootstrap';
import axios from 'axios'
import Swal from 'sweetalert2';

function Login() {
    const [hoverLogin, setHoverLogin] = useState(false);
    const [hoverSignup, setHoverSignup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    })

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(
                `${process.env.REACT_APP_BACKEND_URL}/api/login`,
                {
                    username: formData.username,
                    password: formData.password,
                },
                { withCredentials: true }
            );

            if (res.data.loggedIn) {
                Swal.fire({
                    icon: "success",
                    title: "เข้าสู่ระบบสำเร็จ",
                    showConfirmButton: false,
                    timer: 1500
                }).then(() => {
                    changepage("");
                });
            }
        } catch (err) {
            console.error(err);

            if (err.response && err.response.status === 401) {
                Swal.fire({
                    icon: "error",
                    title: "เข้าสู่ระบบไม่สำเร็จ",
                    text: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
                });
            } else if (err.response) {
                Swal.fire({
                    icon: "error",
                    title: "เข้าสู่ระบบไม่สำเร็จ",
                    text: (err.response.data && (err.response.data.status || err.response.data.message)) || "เกิดข้อผิดพลาด กรุณาลองใหม่",
                });
            } else {
                Swal.fire({
                    icon: "error",
                    title: "เกิดข้อผิดพลาด",
                    text: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้",
                });
            }
        }
    };



    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const changepage = (path) => {
        window.location.href = "/" + path
    }

    useEffect(() => {
        const loading = async () => {
            setLoading(true)
            setTimeout(() => {
                setLoading(false);
            }, 500);

        };

        loading();
    }, []);

    return (
        loading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
                <Spinner animation="border" role="status" size='lg'>
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        ) : (
            <Container fluid className="auth-wrap">
                <Row className="w-100 justify-content-center">
                    <Col xs={12} sm={9} md={7} lg={5} xl={4} style={{ maxWidth: 440 }}>
                        <Card className="p-3" style={{ boxShadow: "var(--shadow-lg)" }}>
                            <Card.Body>
                                <div className="text-center mb-2">
                                    <span className="sb-logo mx-auto mb-3" style={{ width: 52, height: 52, borderRadius: 15, fontSize: 22 }}><i className="fa fa-percent" /></span>
                                    <h3 className="fw-bold mb-1" style={{ fontSize: 22 }}>KPI Dashboard</h3>
                                    <div className="text-muted small">โรงพยาบาลปลายพระยา</div>
                                </div>
                                <Card.Title className="text-center mb-4 mt-3 fw-semibold">เข้าสู่ระบบ</Card.Title>
                                <Form onSubmit={handleLogin}>
                                    <Form.Group className="mb-4" controlId="formUsername">
                                        <Form.Control
                                            type="text"
                                            placeholder="ชื่อผู้ใช้งาน"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleChange}
                                            required
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-4" controlId="formPassword">
                                        <Form.Control
                                            type="password"
                                            placeholder="รหัสผ่าน"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                        />
                                    </Form.Group>

                                    <Button variant="primary" type="submit" className="w-100"
                                        style={{
                                            backgroundColor: hoverLogin ? "#0d7c73ff" : "#0d9488",
                                            color: "#ffffff",
                                            border: 'none',
                                            transition: 'background-color 0.3s'
                                        }} onMouseEnter={() => setHoverLogin(true)}
                                        onMouseLeave={() => setHoverLogin(false)}>
                                        เข้าสู่ระบบ
                                    </Button>
                                </Form>

                                <Button
                                    className="w-100 mt-3"
                                    style={{
                                        backgroundColor: hoverSignup ? "#0d9488" : "transparent",
                                        color: hoverSignup ? "#ffffff" : "#0d9488",
                                        border: '1px solid #0d9488',
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseEnter={() => setHoverSignup(true)}
                                    onMouseLeave={() => setHoverSignup(false)}
                                    onClick={() => changepage("signup")}
                                >
                                    สร้างบัญชีผู้ใช้งาน
                                </Button>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        )
    );
}

export default Login;
