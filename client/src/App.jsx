import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Spinner from './components/Spinner';
import { MODULE_CODE } from '@shared/constants.json';
import './App.css';

// Lazy-load từng trang theo route để bundle không dồn hết vào 1 chunk lớn tải ngay lúc đầu
// (mỗi trang chỉ tải khi người dùng thực sự vào route đó).
const Login = lazy(() => import('./pages/auth/Login'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Users = lazy(() => import('./pages/users/Users'));
const Permissions = lazy(() => import('./pages/permissions/Permissions'));
const AuditLogs = lazy(() => import('./pages/audit-logs/AuditLogs'));
const ModuleActions = lazy(() => import('./pages/module-actions/ModuleActions'));
const Profile = lazy(() => import('./pages/profile/Profile'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteFallback() {
    return (
        <div className="route-fallback">
            <Spinner size={28} />
        </div>
    );
}

function App() {
    return (
        <ToastProvider>
            <AuthProvider>
                <Suspense fallback={<RouteFallback />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />

                        <Route element={<ProtectedRoute />}>
                            <Route element={<Layout />}>
                                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/profile" element={<Profile />} />

                                <Route element={<ProtectedRoute moduleCode={MODULE_CODE.USER} />}>
                                    <Route path="/users" element={<Users />} />
                                </Route>

                                <Route element={<ProtectedRoute moduleCode={MODULE_CODE.PERMISSION} />}>
                                    <Route path="/permissions" element={<Permissions />} />
                                </Route>

                                <Route element={<ProtectedRoute moduleCode={MODULE_CODE.AUDIT} />}>
                                    <Route path="/audit-logs" element={<AuditLogs />} />
                                </Route>

                                <Route element={<ProtectedRoute moduleCode={MODULE_CODE.MODULE_ACTION} />}>
                                    <Route path="/module-actions" element={<ModuleActions />} />
                                </Route>
                            </Route>
                        </Route>

                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </AuthProvider>
        </ToastProvider>
    );
}

export default App;
