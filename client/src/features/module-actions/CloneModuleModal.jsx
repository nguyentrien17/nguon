import { useTranslation } from 'react-i18next';
import { FormModal } from '@/components/form';
import { useToast } from '@/app/providers/ToastContext';
import { cloneModuleSchema } from '@shared/validators/moduleValidators';
import { cloneModule } from './moduleActionApi';

/** Nhân bản một module (kèm action của nó) với mã + tên mới. */
export default function CloneModuleModal({ module, onClose, onSaved }) {
    const { t } = useTranslation();
    const toast = useToast();

    const save = async (data) => {
        await cloneModule(module.id, { module_code: data.module_code, module_name: data.module_name });
        toast.success(t('moduleActions.cloneSuccess'));
        onClose();
        onSaved?.();
    };

    return (
        <FormModal
            title={t('moduleActions.cloneModule')}
            onClose={onClose}
            layout="grid"
            fields={[
                { name: 'module_code', label: t('moduleActions.form.moduleCode'), normalize: (v) => v.toUpperCase() },
                { name: 'module_name', label: t('moduleActions.form.moduleName') },
            ]}
            schema={cloneModuleSchema}
            initialValues={{ module_code: `${module.module_code}_COPY`, module_name: `${module.module_name} (Copy)` }}
            onSubmit={save}
            cancelLabel={t('moduleActions.form.cancel')}
            submitLabel={t('moduleActions.form.save')}
        />
    );
}
