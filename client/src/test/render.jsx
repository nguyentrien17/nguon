import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/app/providers/ToastContext';

/**
 * render() kèm các provider mà hầu hết component cần: Router + Toast.
 * AuthProvider KHÔNG được bọc (nó gọi API khôi phục phiên) — test cần useAuth thì
 * vi.mock('@/core/auth/AuthContext') với giá trị mong muốn.
 */
export function renderWithProviders(ui, { route = '/' } = {}) {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <ToastProvider>{ui}</ToastProvider>
        </MemoryRouter>
    );
}
