import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/auth/AuthContext';
import Spinner from '@/components/ui/Spinner';

/**
 * Chặn route khi chưa đăng nhập, hoặc (có moduleCode) khi không mở được module đó — cùng quy tắc
 * với Sidebar (core/permissions/moduleAccess.js). Chỉ để điều hướng cho đúng; quyền thật do
 * backend kiểm tra ở mọi request.
 */
export default function ProtectedRoute({ moduleCode }) {
    const { isAuthenticated, loading, canOpenModule } = useAuth();
    const location = useLocation();

    // Đang khôi phục phiên từ refresh cookie (F5): hiện spinner thay vì màn hình trắng.
    if (loading) {
        return (
            <div className="route-fallback">
                <Spinner size={28} />
            </div>
        );
    }
    // Gửi kèm trang đang mở để Login quay lại đúng trang sau khi đăng nhập.
    if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
    if (moduleCode && !canOpenModule(moduleCode)) return <Navigate to="/dashboard" replace />;

    return <Outlet />;
}
