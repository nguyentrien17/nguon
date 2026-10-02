import { Suspense } from 'react';
import { ToastProvider } from '@/app/providers/ToastContext';
import { AuthProvider } from '@/core/auth/AuthContext';
import Spinner from '@/components/ui/Spinner';
import AppRoutes from '@/app/router/AppRoutes';
import './App.css';

function RouteFallback() {
    return (
        <div className="route-fallback">
            <Spinner size={28} />
        </div>
    );
}

// Khởi tạo ứng dụng: lắp providers và Suspense boundary. Bảng route nằm ở
// app/router/AppRoutes.jsx. ToastProvider phải bọc ngoài AuthProvider vì AuthContext dùng
// useToast() để thông báo khi phiên hết hạn.
function App() {
    return (
        <ToastProvider>
            <AuthProvider>
                <Suspense fallback={<RouteFallback />}>
                    <AppRoutes />
                </Suspense>
            </AuthProvider>
        </ToastProvider>
    );
}

export default App;
