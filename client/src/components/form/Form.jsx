import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import useForm from '@/hooks/useForm';
import Field from './Field';
import { isHidden, isRequiredBySchema, normalizeField, omitKeys } from './formUtils';
import './form.css';

/**
 * Form dựng từ danh sách trường — chỉ cần khai báo tên trường.
 *
 *   <Form
 *       fields={['email', 'full_name']}                 // chuỗi: type suy từ tên (email/password/text)
 *       labelPrefix="profile.fields"                     // label = t('profile.fields.email')...
 *       schema={updateProfileSchema}                     // zod dùng chung với server: validate + suy "bắt buộc"
 *       initialValues={{ email: user.email, full_name: user.full_name }}
 *       onSubmit={async (data) => { await axiosClient.put('/auth/me', data); toast.success(...); }}
 *   />
 *
 * Trường dạng object khi cần thêm cấu hình:
 *   { name: 'role_ids', type: 'checkboxes', options: [...], label: t('...') }
 *   { name: 'password', hint: t('...'), required: false, hidden: (values) => !!values.id }
 *   { name: 'parent_id', type: 'select', options: [...], span: 2 }
 *   { name: 'attachment', type: 'file', accept: '.pdf', maxSize: 5 * 1024 * 1024 }
 *   { name: 'module_code', normalize: (v) => v.toUpperCase() }      // biến đổi khi gõ
 *   { name: 'module_icon', render: ({ value, onChange }) => <IconPicker ... /> }   // control tuỳ biến
 * Xem docs/ui-components.md mục "Form" để biết đủ các thuộc tính.
 *
 * - `onSubmit(data)`: chỉ được gọi khi dữ liệu hợp lệ; ném lỗi -> toast lỗi đã dịch.
 * - `layout`: 'stack' (mỗi trường một dòng) | 'grid' (2 cột; span: 2 để chiếm cả hàng).
 * - Đổi `key` của <Form> để nạp lại initialValues (vd mở form sửa cho bản ghi khác).
 * - `children`: nội dung thêm sau các trường; có thể là hàm (form) => ReactNode để đọc values.
 */
export default function Form({
    fields,
    schema,
    initialValues,
    validate,
    onSubmit,
    labelPrefix,
    layout = 'stack',
    title,
    submitLabel,
    submitIcon,
    cancelLabel,
    onCancel,
    resetOnSuccess = false,
    onSubmitError,
    disabled = false,
    id: idProp,
    className = '',
    actionsClassName = 'form-actions',
    children,
}) {
    const { t } = useTranslation();
    const autoId = useId();
    const formId = idProp || `form-${autoId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    const defs = fields.map(normalizeField).map((f) => ({
        ...f,
        label: f.label ?? (labelPrefix ? t(`${labelPrefix}.${f.name}`) : f.name),
        required: f.required ?? isRequiredBySchema(schema, f.name),
    }));

    const form = useForm({ fields: defs, initialValues, schema, validate, idPrefix: formId, resetOnSuccess, onSubmitError });
    const visible = defs.filter((f) => !isHidden(f, form.values));
    const busy = disabled || form.submitting;

    return (
        <form id={formId} className={['form', className].filter(Boolean).join(' ')} onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {title && <h2>{title}</h2>}
            {form.formError && <Alert tone="error">{form.formError}</Alert>}

            <div className={layout === 'grid' ? 'form-grid form-layout-grid' : 'form-stack'}>
                {visible.map((f) => (
                    <Field
                        key={f.name}
                        {...omitKeys(f, ['hidden', 'normalize'])}
                        id={`${formId}-${f.name}`}
                        value={form.values[f.name]}
                        onChange={(v) => form.setValue(f.name, f.normalize ? f.normalize(v) : v)}
                        onReject={(message) => form.setError(f.name, message)}
                        error={form.errors[f.name]}
                        disabled={busy || f.disabled}
                    />
                ))}
            </div>

            {typeof children === 'function' ? children(form) : children}

            <div className={actionsClassName}>
                {onCancel && (
                    <Button onClick={onCancel} disabled={form.submitting}>
                        {cancelLabel || t('common.cancel')}
                    </Button>
                )}
                <Button type="submit" variant="primary" icon={submitIcon} loading={form.submitting} disabled={disabled}>
                    {submitLabel || t('common.save')}
                </Button>
            </div>
        </form>
    );
}
