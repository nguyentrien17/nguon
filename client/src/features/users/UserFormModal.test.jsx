import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { label, t } from '@/test/i18nLabel';
import UserFormModal from './UserFormModal';
import * as api from './userApi';

vi.mock('./userApi', () => ({ createUser: vi.fn(), updateUser: vi.fn(), listRoles: vi.fn() }));
const auth = vi.hoisted(() => ({ canAssign: true }));
vi.mock('@/core/auth/AuthContext', () => ({ useAuth: () => ({ can: () => auth.canAssign }) }));

const ROLES = [{ id: 7, permission_name: 'Nhân viên', permission_code: 'ROLE_STAFF' }];

describe('<UserFormModal>', () => {
    beforeEach(() => {
        auth.canAssign = true;
        api.listRoles.mockResolvedValue({ data: ROLES });
        api.createUser.mockResolvedValue({});
        api.updateUser.mockResolvedValue({});
    });

    it('tạo user có gán role: tải role khi mở, gửi đúng payload, gọi onClose + onSaved', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onSaved = vi.fn();
        renderWithProviders(<UserFormModal open user={null} onClose={onClose} onSaved={onSaved} />);

        await user.type(screen.getByLabelText(label('users.form.usernameLabel')), 'alice');
        await user.type(screen.getByLabelText(label('users.form.emailLabel')), 'a@b.co');
        await user.type(screen.getByLabelText(label('users.form.fullNameLabel')), 'Alice');
        await user.type(screen.getByLabelText(label('users.form.passwordLabel')), 'Passw0rd!');
        await user.click(await screen.findByRole('checkbox', { name: /Nhân viên/ }));
        await user.click(screen.getByRole('button', { name: t('users.form.save') }));

        await waitFor(() => expect(api.createUser).toHaveBeenCalledTimes(1));
        expect(api.createUser).toHaveBeenCalledWith({ username: 'alice', email: 'a@b.co', full_name: 'Alice', password: 'Passw0rd!', role_ids: [7] });
        expect(onClose).toHaveBeenCalled();
        expect(onSaved).toHaveBeenCalled();
    });

    it('không có quyền gán role: KHÔNG tải danh sách role, không hiện ô chọn role', async () => {
        auth.canAssign = false;
        renderWithProviders(<UserFormModal open user={null} onClose={vi.fn()} />);
        expect(screen.getByLabelText(label('users.form.emailLabel'))).toBeInTheDocument();
        expect(screen.queryByText(t('users.form.rolesLabel'))).not.toBeInTheDocument();
        expect(api.listRoles).not.toHaveBeenCalled();
    });

    it('sửa user, để trống mật khẩu: KHÔNG gửi password (giữ mật khẩu cũ)', async () => {
        const user = userEvent.setup();
        renderWithProviders(<UserFormModal open user={{ id: 5, email: 'old@b.co', full_name: 'Old' }} onClose={vi.fn()} />);

        expect(screen.queryByLabelText(label('users.form.usernameLabel'))).not.toBeInTheDocument();
        await user.clear(screen.getByLabelText(label('users.form.fullNameLabel')));
        await user.type(screen.getByLabelText(label('users.form.fullNameLabel')), 'New');
        await user.click(screen.getByRole('button', { name: t('users.form.save') }));

        await waitFor(() => expect(api.updateUser).toHaveBeenCalledTimes(1));
        const [id, payload] = api.updateUser.mock.calls[0];
        expect(id).toBe(5);
        expect(payload).toEqual({ email: 'old@b.co', full_name: 'New', password: undefined });
        expect(JSON.stringify(payload)).not.toContain('password');
    });

    it('lỗi validate hiện dưới ô, không gọi API', async () => {
        const user = userEvent.setup();
        renderWithProviders(<UserFormModal open user={null} onClose={vi.fn()} />);
        await user.type(screen.getByLabelText(label('users.form.usernameLabel')), 'ab');
        await user.click(screen.getByRole('button', { name: t('users.form.save') }));
        expect(await screen.findByText(/quá ngắn/)).toBeInTheDocument();
        expect(api.createUser).not.toHaveBeenCalled();
    });
});
