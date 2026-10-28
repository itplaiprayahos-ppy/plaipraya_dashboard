import { Spinner } from 'react-bootstrap';

export function FullPageLoading() {
    return (
        <div className="page-loading">
            <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
            </Spinner>
        </div>
    );
}

export function OverlayLoading({ show }) {
    if (!show) return null;
    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.25)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999,
        }}>
            <Spinner animation="border" role="status" variant="light">
                <span className="visually-hidden">Loading...</span>
            </Spinner>
        </div>
    );
}
