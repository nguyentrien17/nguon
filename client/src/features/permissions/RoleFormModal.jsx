import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Tabs } from '@/components/ui';
import { Field } from '@/components/form';
import useForm from '@/hooks/useForm';
import { useToast } from '@/app/providers/ToastContext';
import { createPermissionSchema, updatePermissionSchema } from '@shared/validators/permissionValidators';
import PermissionTreeEditor from './PermissionTreeEditor';
import { detailsFromSelection, selectionFromDetails } from './permissionTree';
import { createRole, updateRole } from './permissionApi';

/**
 * Form tạo / sửa role: tab 1 thông tin, tab 2 cây quyền. Một nút Lưu cho cả hai tab.
 *
 *   {roleForm && <RoleFormModal role={...} parent={...} modules={...} actions={...} onClose onSaved />}
 *
 * - `role`: null = tạo mới; object = sửa. `parent`: role cha khi tạo role con.
 * - Render có điều kiện (chỉ khi mở) để mỗi lần mở là state mới.
 */
export default function RoleFormModal({ role, parent, modules, actions, onClose, onSaved }) {
    const { t } = useTranslation();
    const toast = useToast();
    const formId = `role-form-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const isEdit = !!role;
    const [tab, setTab] = useState('info');
    const [selection, setSelection] = useState(() => selectionFromDetails(role?.details));

    const fields = [
        { name: 'permission_code', label: t('permissions.roleCode'), disabled: isEdit, required: !isEdit },
        { name: 'permission_name', label: t('permissions.roleName'), required: true },
        { name: 'description', label: t('permissions.roleDescription'), span: 2 },
    ];

    const form = useForm({
        fields,
        schema: isEdit ? updatePermissionSchema : createPermissionSchema,
        initialValues: isEdit
            ? { permission_code: role.permission_code, permission_name: role.permission_name, description: role.description || '' }
            : { permission_parent_id: parent?.id ?? null },
        idPrefix: formId,
    });

    // Lỗi đều nằm ở tab Thông tin: bấm Lưu khi đang ở tab Phân quyền mà có lỗi -> quay về tab 1
    // (useForm tự focus ô lỗi đầu tiên sau khi tab hiện ra). Số lỗi hiện trên nhãn tab.
    const errorCount = Object.keys(form.errors).length + (form.formError ? 1 : 0);
    const onInvalid = () => setTab('info');

    const save = async (data) => {
        const details = detailsFromSelection(selection);
        // description: '' -> null để XOÁ mô tả cũ (Form bỏ trường trống nên phải gán tường minh).
        if (isEdit) {
            await updateRole(role.id, { permission_name: data.permission_name, description: data.description ?? null, details });
            toast.success(t('permissions.updated'));
        } else {
            await createRole({
                permission_code: data.permission_code,
                permission_name: data.permission_name,
                description: data.description ?? null,
                permission_parent_id: data.permission_parent_id ?? null,
                details,
            });
            toast.success(t('permissions.created'));
        }
        onClose();
        onSaved?.();
    };

    const fieldProps = (f) => ({
        ...f,
        id: `${formId}-${f.name}`,
        value: form.values[f.name],
        onChange: (v) => form.setValue(f.name, v),
        error: form.errors[f.name],
        disabled: form.submitting || f.disabled,
    });

    return (
        <Modal
            open
            title={isEdit ? t('permissions.updateTitle') : t('permissions.create')}
            onClose={onClose}
            busy={form.submitting}
            as="form"
            onSubmit={form.handleSubmit(save, onInvalid)}
            size="wide"
            footer={
                <>
                    <Button onClick={onClose} disabled={form.submitting}>
                        {t('users.form.cancel')}
                    </Button>
                    <Button type="submit" variant="primary" loading={form.submitting}>
                        {t('users.form.save')}
                    </Button>
                </>
            }
        >
            <Tabs
                tabs={[
                    { key: 'info', label: `1. ${t('permissions.tabInfo')}`, badge: errorCount || null },
                    { key: 'perm', label: `2. ${t('permissions.tabPermissions')}` },
                ]}
                active={tab}
                onChange={setTab}
            />

            {/* Giữ cả hai tab trong DOM (chỉ ẩn) để không mất giá trị khi chuyển tab. */}
            <div className="perm-tab-panel" hidden={tab !== 'info'}>
                {parent && (
                    <div className="perm-parent-hint">
                        {t('permissions.parentRole')}: <strong>{parent.permission_name}</strong>
                    </div>
                )}
                {form.formError && <div className="field-error">{form.formError}</div>}
                <div className="form-grid form-layout-grid">
                    {fields.map((f) => (
                        <Field key={f.name} {...fieldProps(f)} />
                    ))}
                </div>
            </div>

            <div className="perm-tab-panel" hidden={tab !== 'perm'}>
                <PermissionTreeEditor modules={modules} actions={actions} value={selection} onChange={setSelection} />
            </div>
        </Modal>
    );
}
