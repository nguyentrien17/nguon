import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { label, t } from '@/test/i18nLabel';
import RoleFormModal from './RoleFormModal';
import * as api from './permissionApi';

vi.mock('./permissionApi', () => ({ createRole: vi.fn(), updateRole: vi.fn() }));

const modules = [{ id: 1, module_code: 'MOD_USER', module_name: 'Users', module_parent_id: null }];
const actions = [
    { id: 10, module_id: 1, action_code: 'view', action_name: 'Xem' },
    { id: 11, module_id: 1, action_code: 'edit', action_name: 'Sửa' },
];
const tab = (key) => screen.getByRole('tab', { name: new RegExp(t(key)) });

describe('<RoleFormModal>', () => {
    beforeEach(() => {
        api.createRole.mockResolvedValue({});
        api.updateRole.mockResolvedValue({});
    });

    it('bấm Lưu ở tab Phân quyền khi tab Thông tin còn lỗi -> tự quay về tab Thông tin, nhãn tab hiện số lỗi', async () => {
        const user = userEvent.setup();
        renderWithProviders(<RoleFormModal role={null} parent={null} modules={modules} actions={actions} onClose={vi.fn()} />);

        await user.click(tab('permissions.tabPermissions'));
        expect(tab('permissions.tabPermissions')).toHaveAttribute('aria-selected', 'true');
        await user.click(screen.getByRole('button', { name: t('users.form.save') }));

        await waitFor(() => expect(tab('permissions.tabInfo')).toHaveAttribute('aria-selected', 'true'));
        expect(tab('permissions.tabInfo')).toHaveTextContent('2'); // mã + tên đều trống
        expect(api.createRole).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.getByLabelText(label('permissions.roleCode'))).toHaveFocus());
    });

    it('tạo role con: gửi quyền đã tích (edit kéo theo view), mô tả trống -> null, kèm parent', async () => {
        const user = userEvent.setup();
        renderWithProviders(
            <RoleFormModal role={null} parent={{ id: 3, permission_name: 'Cha' }} modules={modules} actions={actions} onClose={vi.fn()} />
        );

        await user.type(screen.getByLabelText(label('permissions.roleCode')), 'ROLE_X');
        await user.type(screen.getByLabelText(label('permissions.roleName')), 'Vai trò X');
        await user.click(tab('permissions.tabPermissions'));
        await user.click(screen.getByRole('checkbox', { name: 'edit — Sửa' }));
        await user.click(screen.getByRole('button', { name: t('users.form.save') }));

        await waitFor(() => expect(api.createRole).toHaveBeenCalledTimes(1));
        const payload = api.createRole.mock.calls[0][0];
        expect(payload).toMatchObject({ permission_code: 'ROLE_X', permission_name: 'Vai trò X', description: null, permission_parent_id: 3 });
        expect(payload.details).toEqual(expect.arrayContaining([{ module_id: 1, action_id: 10 }, { module_id: 1, action_id: 11 }]));
    });

    it('sửa role, xoá trắng mô tả -> gửi description: null (để xoá trong DB)', async () => {
        const user = userEvent.setup();
        const role = { id: 9, permission_code: 'ROLE_X', permission_name: 'X', description: 'Mô tả cũ', details: [{ module_id: 1, action_id: 10 }] };
        renderWithProviders(<RoleFormModal role={role} parent={null} modules={modules} actions={actions} onClose={vi.fn()} />);

        expect(screen.getByLabelText(label('permissions.roleCode'))).toBeDisabled();
        await user.clear(screen.getByLabelText(label('permissions.roleDescription')));
        await user.click(screen.getByRole('button', { name: t('users.form.save') }));

        await waitFor(() => expect(api.updateRole).toHaveBeenCalledTimes(1));
        expect(api.updateRole).toHaveBeenCalledWith(9, { permission_name: 'X', description: null, details: [{ module_id: 1, action_id: 10 }] });
    });
});
