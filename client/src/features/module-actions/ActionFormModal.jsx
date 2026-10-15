import { useTranslation } from 'react-i18next';
import { FormModal } from '@/components/form';
import { useToast } from '@/app/providers/ToastContext';
import { createActionSchema, updateActionSchema } from '@shared/validators/actionValidators';
import { createAction, updateAction } from './moduleActionApi';

/**
 * Form tạo / sửa action của một module.
 *
 *   {actionForm && <ActionFormModal action={...} moduleId={...} onClose onSaved />}
 */
export default function ActionFormModal({ action, moduleId, onClose, onSaved }) {
    const { t } = useTranslation();
    const toast = useToast();
    const isEdit = !!action;

    const fields = [
        { name: 'action_code', label: t('moduleActions.form.actionCode'), hidden: isEdit, normalize: (v) => v.toLowerCase() },
        { name: 'action_name', label: t('moduleActions.form.actionName'), required: true, span: isEdit ? 2 : undefined },
        {
            name: 'rate_limit_per_minute',
            type: 'number',
            min: 1,
            label: t('moduleActions.form.rateLimit'),
            placeholder: t('moduleActions.form.rateLimitPlaceholder'),
        },
        { name: 'description', label: t('moduleActions.form.description'), span: 2 },
    ];

    const initialValues = isEdit
        ? { action_name: action.action_name, rate_limit_per_minute: action.rate_limit_per_minute ?? '', description: action.description || '' }
        : { module_id: moduleId };

    const save = async (data) => {
        // Để trống giới hạn / mô tả -> null để XOÁ giá trị cũ.
        const common = {
            action_name: data.action_name,
            description: data.description ?? null,
            rate_limit_per_minute: data.rate_limit_per_minute ?? null,
        };
        if (isEdit) {
            await updateAction(action.id, common);
        } else {
            await createAction({ ...common, module_id: data.module_id, action_code: data.action_code });
        }
        toast.success(t('moduleActions.saved'));
        onClose();
        onSaved?.();
    };

    return (
        <FormModal
            title={isEdit ? t('moduleActions.form.editActionTitle') : t('moduleActions.form.createActionTitle')}
            onClose={onClose}
            layout="grid"
            fields={fields}
            schema={isEdit ? updateActionSchema : createActionSchema}
            initialValues={initialValues}
            onSubmit={save}
            cancelLabel={t('moduleActions.form.cancel')}
            submitLabel={t('moduleActions.form.save')}
        />
    );
}
