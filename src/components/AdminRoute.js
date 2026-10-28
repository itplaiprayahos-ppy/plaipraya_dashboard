import { Navigate } from 'react-router-dom';
import { Container, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { FullPageLoading } from './Loading';

export default function AdminRoute({ children }) {
    const { user, loading, isAdmin } = useAuth();
    if (loading) return <FullPageLoading />;
    if (!user) return <Navigate to="/login" replace />;
    if (!isAdmin) {
        return (
            <Container className="py-5">
                <Alert variant="warning">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</Alert>
            </Container>
        );
    }
    return children;
}
