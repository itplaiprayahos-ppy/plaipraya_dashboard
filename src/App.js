import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';
import Sidebar from './components/SideBar';
import Footer from './components/Footer';
import TopBar from './components/TopBar';
import AdminRoute from './components/AdminRoute';
import HomePage from './page/HomePage';
import KpiGroupPage from './page/KpiGroupPage';
import KpiDetailPage from './page/KpiDetailPage';
import Login from './page/Login';
import Signup from './page/Signup';
import ProfileEdit from './page/ProfileEdit';
import NotFound from './page/NotFound ';
import PpFeeSchedule from './page/PpFeeSchedule';
import AdminPPFeePage from './page/AdminPPFeePage';
import AdminKpiPage from './page/admin/AdminKpiPage';
import AdminGroupPage from './page/admin/AdminGroupPage';
import AdminSettingsPage from './page/admin/AdminSettingsPage';
import AdminHdcPage from './page/admin/AdminHdcPage';
import AdminUsersPage from './page/admin/AdminUsersPage';
import AdminYearsPage from './page/admin/AdminYearsPage';
import AdminLogsPage from './page/admin/AdminLogsPage';

// ลิงก์รายละเอียดแบบเดิม (/kpi/mou/detail/<ชื่อ>?...) -> กลับไปหน้ากลุ่ม
function LegacyDetailRedirect() {
    const { slug } = useParams();
    return <Navigate to={`/kpi/${slug}`} replace />;
}

function DetailRoute() {
    const { id } = useParams();
    return /^\d+$/.test(id) ? <KpiDetailPage /> : <LegacyDetailRedirect />;
}

function App() {
    return (
        <div className="App">
            <AuthProvider>
                <AppDataProvider>
                    <BrowserRouter>
                        <div style={{ display: 'flex' }}>
                            <Sidebar />
                            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', minWidth: 0 }}>
                                <TopBar />
                                <div style={{ width: '100%', flex: 1 }}>
                                    <Routes>
                                        <Route path="/" element={<HomePage />} />
                                        <Route path="/kpi/:slug" element={<KpiGroupPage />} />
                                        <Route path="/kpi/:slug/detail/:id" element={<DetailRoute />} />
                                        <Route path="/login" element={<Login />} />
                                        <Route path="/signup" element={<Signup />} />
                                        <Route path="/profile-edit" element={<ProfileEdit />} />
                                        <Route path="/pp-fee/:years" element={<PpFeeSchedule />} />
                                        <Route path="/pp-fee-management" element={<AdminRoute><AdminPPFeePage /></AdminRoute>} />

                                        <Route path="/admin/kpis" element={<AdminRoute><AdminKpiPage /></AdminRoute>} />
                                        <Route path="/admin/years" element={<AdminRoute><AdminYearsPage /></AdminRoute>} />
                                        <Route path="/admin/groups" element={<AdminRoute><AdminGroupPage /></AdminRoute>} />
                                        <Route path="/admin/hdc" element={<AdminRoute><AdminHdcPage /></AdminRoute>} />
                                        <Route path="/admin/settings" element={<AdminRoute><AdminSettingsPage /></AdminRoute>} />
                                        <Route path="/admin/logs" element={<AdminRoute><AdminLogsPage /></AdminRoute>} />
                                        <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />

                                        <Route path="*" element={<NotFound />} />
                                    </Routes>
                                </div>
                                <Footer />
                            </div>
                        </div>
                    </BrowserRouter>
                </AppDataProvider>
            </AuthProvider>
        </div>
    );
}

export default App;
