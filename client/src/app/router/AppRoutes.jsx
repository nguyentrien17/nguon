import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/core/permissions/ProtectedRoute';
import Layout from '@/app/layout/Layout';
import { MODULE_CODE } from '@shared/constants.json';

// Lazy-load từng trang theo route để bundle không dồn hết vào 1 chunk lớn tải ngay lúc đầu
// (mỗi trang chỉ tải khi người dùng thực sự vào route đó).
const Login = lazy(() => import('@/features/auth/Login'));
const ForgotPassword = lazy(() => import('@/features/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/features/auth/ResetPassword'));
const Dashboard = lazy(() => import('@/features/dashboard/Dashboard'));
const Users = lazy(() => import('@/features/users/Users'));
const Permissions = lazy(() => import('@/features/permissions/Permissions'));
const AuditLogs = lazy(() => import('@/features/audit-logs/AuditLogs'));
const ModuleActions = lazy(() => import('@/features/module-actions/ModuleActions'));
const Profile = lazy(() => import('@/features/profile/Profile'));
const NotFound = lazy(() => import('@/app/NotFound'));

// Chỉ chứa bảng route. Providers và Suspense nằm ở app/App.jsx — tách ra để thêm/bớt một
// route không phải chạm vào phần khởi tạo ứng dụng, và ngược lại.
//
// Phân quyền ở đây CHỈ để ẩn/chặn điều hướng cho đúng trải nghiệm; quyền thật được backend
// kiểm tra lại ở mọi request (docs/architecture.md §6). Đừng coi ProtectedRoute là bảo mật.
export default function AppRoutes() {
    return (
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
    );
}
