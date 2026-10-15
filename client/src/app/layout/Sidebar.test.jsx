import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { canOpenModule } from '@/core/permissions/moduleAccess';
import Sidebar from './Sidebar';

const auth = vi.hoisted(() => ({ value: {} }));
vi.mock('@/core/auth/AuthContext', () => ({ useAuth: () => auth.value }));

const modules = [
    { id: 1, module_code: 'MOD_DASHBOARD', module_name: 'Tổng quan', module_href: '/dashboard', module_type: 1, module_parent_id: null },
    { id: 2, module_code: 'MOD_USER', module_name: 'Người dùng', module_href: '/users', module_type: 1, module_parent_id: null },
    { id: 3, module_code: 'MOD_SCREEN', module_name: 'Màn hình', module_href: '/x', module_type: 2, module_parent_id: null },
];

function setPermissions(pairs) {
    const permissions = pairs.map(([module_code, action_code]) => ({ module_code, action_code }));
    auth.value = { modules, canOpenModule: (code) => canOpenModule(code, permissions) };
}

describe('<Sidebar>', () => {
    it('chỉ có quyền edit trên MOD_USER -> KHÔNG hiện menu Người dùng (route đòi view)', () => {
        setPermissions([['MOD_DASHBOARD', 'view'], ['MOD_USER', 'edit']]);
        renderWithProviders(<Sidebar open />);
        expect(screen.getByRole('link', { name: /Tổng quan/ })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Người dùng/ })).not.toBeInTheDocument();
    });

    it('có quyền view -> hiện; module loại Màn hình không bao giờ lên menu', () => {
        setPermissions([['MOD_USER', 'view'], ['MOD_SCREEN', 'view']]);
        renderWithProviders(<Sidebar open />);
        expect(screen.getByRole('link', { name: /Người dùng/ })).toHaveAttribute('href', '/users');
        expect(screen.queryByText('Màn hình')).not.toBeInTheDocument();
    });
});
