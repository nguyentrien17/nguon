import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('@/core/auth/AuthContext', () => ({ useAuth: () => auth.value }));

function LoginProbe() {
    const location = useLocation();
    return <div>login, from={location.state?.from?.pathname}{location.state?.from?.search}</div>;
}

const renderAt = (path) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/login" element={<LoginProbe />} />
                <Route path="/dashboard" element={<div>dashboard</div>} />
                <Route element={<ProtectedRoute moduleCode="MOD_USER" />}>
                    <Route path="/users" element={<div>users page</div>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );

describe('<ProtectedRoute>', () => {
    beforeEach(() => {
        auth.value = { isAuthenticated: true, loading: false, canOpenModule: () => true };
    });

    it('chưa đăng nhập -> /login KÈM trang đang mở (để quay lại sau khi đăng nhập)', () => {
        auth.value = { isAuthenticated: false, loading: false, canOpenModule: () => false };
        renderAt('/users?page=3');
        expect(screen.getByText('login, from=/users?page=3')).toBeInTheDocument();
    });

    it('đang khôi phục phiên -> spinner, không phải màn hình trắng', () => {
        auth.value = { isAuthenticated: false, loading: true, canOpenModule: () => false };
        renderAt('/users');
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('không mở được module -> về dashboard', () => {
        auth.value.canOpenModule = () => false;
        renderAt('/users');
        expect(screen.getByText('dashboard')).toBeInTheDocument();
    });

    it('đủ quyền -> vào trang', () => {
        renderAt('/users');
        expect(screen.getByText('users page')).toBeInTheDocument();
    });
});
