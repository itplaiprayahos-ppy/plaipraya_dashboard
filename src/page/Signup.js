import React, { useState } from 'react';
import Swal from "sweetalert2";
import { Form, Button, Card, Container, Row, Col } from 'react-bootstrap';
import axios from 'axios'

function Signup() {
    const [hoverLogin, setHoverLogin] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        passwordConfirm: '',
        email: '',
        firstname: '',
        lastname: '',
        department: '',
    })

    const department_list = ["ควบคุมโรคติดต่อ (IDC)", "ควบคุมโรคไม่ติดต่อ (NCD)", "ควบคุมผู้บริโภค (CPC)", "ทรัพยากรบุคคล (HRM)", "ทันตสาธารณสุข (DEN)",
        "นิติการ (LEG)", "บริหารทั่วไป (ADM)", "ปฐมภูมิและเครือข่ายสุขภาพ (PRI)", "ประกันสุขภาพ (HIN)", "พัฒนาคุณภาพบริหาร (QIS)", "ยุทธศาสตร์สาธารณสุข (PHS)",
        "สุขภาพดิจิทัล (DGH)", "ส่งเสริมสุขภาพ (HPR)", "อนามัยสิ่งแวดล้อม (ENV)", "แพทย์แผนไทย (TMD)", "อื่นๆ (OTH)"
    ]

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const changepage = (path) => {
        window.location.href = "/" + path
    }

    const handleSignup = async (e) => {
        e.preventDefault();

        if (formData.password !== formData.passwordConfirm) {
            Swal.fire({
                icon: 'error',
                title: 'Password ไม่ตรงกัน',
                confirmButtonText: 'ตกลง'
            });
            return;
        }

        try {
            const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/signup`, {
                username: formData.username,
                password: formData.password,
                email: formData.email,
                first_name: formData.firstname,
                last_name: formData.lastname,
                department: formData.department
            }, { withCredentials: true });

            if (res.data.loggedIn) {
                Swal.fire({
                    icon: 'success',
                    title: 'สมัครสมาชิกสำเร็จ',
                    text: 'ไปยังหน้า Login เพื่อเข้าสู่ระบบ',
                    confirmButtonText: 'ตกลง'
                }).then(() => {
                    changepage('login');
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'สมัครสมาชิกไม่สำเร็จ',
                    text: res.data.status,
                    confirmButtonText: 'ตกลง'
                });
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: (err.response && err.response.data && err.response.data.status) || 'ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่',
                confirmButtonText: 'ตกลง'
            });
        }
    };


    return (
        <Container fluid className="d-flex justify-content-center align-items-center h-100">
            <Row className="w-100 justify-content-center">
                <Col xs={12} sm={10} md={8} lg={6} xl={5}>
                    <Card className="shadow p-4">
                        <Card.Body>
                            <h3 className="text-center">KPI Dashboard</h3>
                            <Card.Title className="text-center mb-4">ลงทะเบียน</Card.Title>

                            <Form onSubmit={handleSignup}>
                                <Row>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3" controlId="formFirstname">
                                            <Form.Control
                                                type="text"
                                                placeholder="ชื่อ"
                                                name="firstname"
                                                value={formData.firstname}
                                                onChange={handleChange}
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3" controlId="formLastname">
                                            <Form.Control
                                                type="text"
                                                placeholder="นามสกุล"
                                                name="lastname"
                                                value={formData.lastname}
                                                onChange={handleChange}
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <Form.Group className="mb-3" controlId="formDepartment">
                                    <Form.Select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
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

                                <Form.Group className="mb-3" controlId="formEmail">
                                    <Form.Control
                                        type="email"
                                        placeholder="อีเมล"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3" controlId="formUsername">
                                    <Form.Control
                                        type="text"
                                        placeholder="ชื่อผู้ใช้งาน"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3" controlId="formPassword">
                                    <Form.Control
                                        type="password"
                                        placeholder="รหัสผ่าน"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-4" controlId="formPasswordConfirm">
                                    <Form.Control
                                        type="password"
                                        placeholder="รหัสผ่านอีกครั้ง"
                                        name="passwordConfirm"
                                        value={formData.passwordConfirm}
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
                                    }}
                                    onMouseEnter={() => setHoverLogin(true)}
                                    onMouseLeave={() => setHoverLogin(false)}>
                                    ลงทะเบียน
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    )
}

export default Signup