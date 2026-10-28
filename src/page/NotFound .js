import React from 'react';
import { Container, Button } from 'react-bootstrap';
import svg from "../images/404.svg";

function NotFound() {
    const changepage = (path) => {
        window.location.href = '/' + path;
    };

    return (
        <Container fluid className="d-flex align-items-center justify-content-center p-0" style={{ minHeight: '70vh' }}>
            <div className="text-center">
                <img src={svg} alt="svg" />
                <h1 className="page-title mt-3">ไม่พบหน้าที่ต้องการ</h1>
                <p className="text-muted mb-4">หน้านี้อาจถูกย้ายหรือลบไปแล้ว</p>
                <Button variant="primary" onClick={() => changepage('')}>
                    กลับสู่หน้าหลัก
                </Button>
            </div>
        </Container>
    );
}

export default NotFound;