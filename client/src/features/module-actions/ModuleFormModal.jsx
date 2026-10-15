import { useTranslation } from 'react-i18next';
import { FormModal } from '@/components/form';
import { useToast } from '@/app/providers/ToastContext';
import { MODULE_TYPE } from '@shared/constants.json';
import { createModuleSchema, updateModuleSchema } from '@shared/validators/moduleValidators';
import IconPicker from './IconPicker';
import { createModule, updateModule } from './moduleActionApi';

/**
 * Form tạo / sửa module.
 *
 *   {moduleForm && <ModuleFormModal module={...} parentId={...} onClose onSaved />}
 *
 * `module`: null = tạo mới (dưới `parentId`, null = module gốc); object = sửa.
 */
export default function ModuleFormModal({ module, parentId = null, onClose, onSaved }) {
    const { t } = useTranslation();
    const toast = useToast();
    const isEdit = !!module;

    const fields = [
        { name: 'module_code', label: t('moduleActions.form.moduleCode'), hidden: isEdit, normalize: (v) => v.toUpperCase() },
        { name: 'module_name', label: t('moduleActions.form.moduleName'), required: true, span: isEdit ? 2 : undefined },
        { name: 'module_href', label: t('moduleActions.form.moduleHref'), placeholder: '/example', span: 2 },
        {
            name: 'module_type',
            type: 'select',
            label: t('moduleActions.form.moduleType'),
            placeholder: false,
            span: 2,
            options: [
                { value: MODULE_TYPE.MENU, label: t('moduleActions.form.moduleTypeMenu') },
                { value: MODULE_TYPE.SCREEN, label: t('moduleActions.form.moduleTypeScreen') },
            ],
        },
        {
            name: 'module_icon',
            label: t('moduleActions.form.moduleIcon'),
            span: 2,
            render: (props) => <IconPicker {...props} />,
        },
        { name: 'module_element_id', label: t('moduleActions.form.moduleElementId') },
        { name: 'module_index', type: 'number', label: t('moduleActions.form.moduleIndex') },
        { name: 'description', label: t('moduleActions.form.description'), span: 2 },
    ];

    const initialValues = isEdit
        ? {
              module_name: module.module_name,
              module_type: module.module_type || MODULE_TYPE.MENU,
              module_icon: module.module_icon || '',
              module_href: module.module_href || '',
              module_element_id: module.module_element_id || '',
              module_index: module.module_index ?? 0,
              description: module.description || '',
          }
        : { module_parent_id: parentId, module_type: MODULE_TYPE.MENU, module_icon: '', module_index: 0 };

    const save = async (data) => {
        // Trường tuỳ chọn để trống -> null để XOÁ giá trị cũ (Form bỏ trường trống nên phải gán tường minh).
        const common = {
            module_name: data.module_name,
            module_type: data.module_type || MODULE_TYPE.MENU,
            module_icon: data.module_icon || null,
            module_href: data.module_href ?? null,
            module_element_id: data.module_element_id ?? null,
            module_index: Number(data.module_index) || 0,
            description: data.description ?? null,
        };
        if (isEdit) {
            await updateModule(module.id, common);
        } else {
            await createModule({ ...common, module_code: data.module_code, module_parent_id: data.module_parent_id || null });
        }
        toast.success(t('moduleActions.saved'));
        onClose();
        onSaved?.();
    };

    return (
        <FormModal
            title={isEdit ? t('moduleActions.form.editModuleTitle') : t('moduleActions.form.createModuleTitle')}
            onClose={onClose}
            layout="grid"
            fields={fields}
            schema={isEdit ? updateModuleSchema : createModuleSchema}
            initialValues={initialValues}
            onSubmit={save}
            cancelLabel={t('moduleActions.form.cancel')}
            submitLabel={t('moduleActions.form.save')}
        />
    );
}
