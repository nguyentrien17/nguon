import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormModal } from '@/components/form';
import { useToast } from '@/app/providers/ToastContext';
import { usePermissions } from '@/core/permissions/PermissionsContext';
import { MODULE_CODE, ACTION_CODE } from '@shared/constants.json';
import { createUserSchema, updateUserSchema } from '@shared/validators/userValidators';
import { createUser, listRoles, updateUser } from './userApi';

/**
 * Form tạo / sửa user trong hộp thoại.
 *
 *   <UserFormModal open={open} user={editing} onClose={close} onSaved={list.reload} />
 *
 * - `user`: null = tạo mới; object = sửa user đó.
 * - `onSaved()`: gọi sau khi lưu thành công (trang cha nạp lại danh sách). Modal tự đóng.
 */
export default function UserFormModal({ open, user, onClose, onSaved }) {
    const { t } = useTranslation();
    const toast = useToast();
    const { can } = usePermissions();
    const [roles, setRoles] = useState(null); // null = chưa tải

    const isEdit = !!user;
    // Gán role lúc tạo user cần thêm MOD_PERMISSION:edit (server kiểm tra lại — userService.assertCanAssignRoles).
    const canAssignRoles = !isEdit && can(MODULE_CODE.PERMISSION, ACTION_CODE.EDIT);

    // Chỉ tải danh sách role khi thật sự cần (form tạo mới + có quyền gán), và chỉ một lần.
    useEffect(() => {
        if (!open || !canAssignRoles || roles !== null) return;
        listRoles()
            .then((res) => setRoles(res.data))
            .catch(() => setRoles([]));
    }, [open, canAssignRoles, roles]);

    const fields = [
        { name: 'username', label: t('users.form.usernameLabel'), autoComplete: 'off', hidden: isEdit },
        { name: 'email', label: t('users.form.emailLabel'), required: true },
        { name: 'full_name', label: t('users.form.fullNameLabel'), required: true, span: isEdit ? 2 : undefined },
        {
            name: 'password',
            label: t('users.form.passwordLabel'),
            autoComplete: 'new-password',
            span: 2,
            placeholder: isEdit ? t('users.passwordKeepHint') : undefined,
        },
        {
            name: 'role_ids',
            type: 'checkboxes',
            label: t('users.form.rolesLabel'),
            span: 2,
            options: (roles ?? []).map((r) => ({ value: r.id, label: r.permission_name, hint: r.permission_code })),
            emptyMessage: roles === null ? t('common.loading') : t('users.noRoles'),
            hidden: !canAssignRoles,
        },
    ];

    const save = async (data) => {
        if (isEdit) {
            // password rỗng đã bị Form bỏ (undefined) -> không gửi -> giữ mật khẩu cũ.
            await updateUser(user.id, { email: data.email, full_name: data.full_name, password: data.password });
            toast.success(t('users.updated'));
        } else {
            const { username, email, full_name, password, role_ids } = data;
            await createUser({ username, email, full_name, password, role_ids: role_ids ?? [] });
            toast.success(t('users.created'));
        }
        onClose();
        onSaved?.();
    };

    // Modal đóng -> Form bị gỡ khỏi cây, nên mỗi lần mở là form mới với initialValues mới.
    return (
        <FormModal
            open={open}
            title={isEdit ? t('users.edit') : t('users.create')}
            onClose={onClose}
            layout="grid"
            fields={fields}
            schema={isEdit ? updateUserSchema : createUserSchema}
            initialValues={isEdit ? { email: user.email, full_name: user.full_name } : { role_ids: [] }}
            onSubmit={save}
            cancelLabel={t('users.form.cancel')}
            submitLabel={t('users.form.save')}
        />
    );
}
