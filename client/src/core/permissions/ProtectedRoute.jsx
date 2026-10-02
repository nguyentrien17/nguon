import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/core/auth/AuthContext';
import { ACTION_CODE } from '@shared/constants.json';

export default function ProtectedRoute({ moduleCode }) {
    const { isAuthenticated, loading, can } = useAuth();

    if (loading) return null;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (moduleCode && !can(moduleCode, ACTION_CODE.VIEW)) return <Navigate to="/dashboard" replace />;

    return <Outlet />;
}
