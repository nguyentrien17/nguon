import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/app/providers/ToastContext';
import { getErrorMessage } from '@/core/errors/errorMessage';
import { translateZodIssue } from '@/core/errors/zodErrorMessage';
import { buildInitialValues, validateForm } from '@/components/form/formUtils';

/**
 * State + validate + submit cho một form. <Form> dùng hook này; tự dựng form tuỳ biến thì dùng
 * trực tiếp cùng <Field>.
 *
 *   const form = useForm({ fields, schema: createUserSchema, initialValues });
 *   <form onSubmit={form.handleSubmit(async (data) => { await api(data); })}>
 *       <Field ... value={form.values.email} onChange={(v) => form.setValue('email', v)} error={form.errors.email} />
 *
 * `fields`: các field đã chuẩn hoá ({ name, type, label, required?, hidden? }) — dùng để biết
 * trường nào bắt buộc / đang ẩn và lấy label cho thông báo lỗi.
 *
 * Khi submit: validateForm() (components/form/formUtils.js — bỏ trường ẩn, '' -> undefined,
 * kiểm tra bắt buộc, schema zod, validate tuỳ chọn). Có lỗi -> focus trường lỗi đầu tiên, KHÔNG
 * gọi onValid. Hợp lệ -> onValid(data) với data đã qua schema (trim, default...). onValid ném
 * lỗi -> toast lỗi đã dịch (hoặc onSubmitError nếu truyền).
 */
export default function useForm({ fields = [], initialValues, schema, validate, idPrefix, resetOnSuccess = false, onSubmitError } = {}) {
    const { t } = useTranslation();
    const toast = useToast();
    const [values, setValues] = useState(() => buildInitialValues(fields, initialValues));
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const setValue = useCallback((name, value) => {
        setValues((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => {
            if (!prev[name]) return prev;
            const next = { ...prev };
            delete next[name];
            return next;
        });
        setFormError(null);
    }, []);

    const setError = useCallback((name, message) => setErrors((prev) => ({ ...prev, [name]: message })), []);

    const reset = (nextInitial = initialValues) => {
        setValues(buildInitialValues(fields, nextInitial));
        setErrors({});
        setFormError(null);
    };

    // onInvalid({ errors, formError }) tuỳ chọn: gọi khi dữ liệu không hợp lệ — vd form nhiều tab
    // chuyển về tab chứa trường lỗi.
    const handleSubmit = (onValid, onInvalid) => async (e) => {
        e?.preventDefault?.();
        if (submitting) return;

        const result = validateForm({
            fields,
            values,
            schema,
            validate,
            t,
            translateIssue: (issue, label) => translateZodIssue(issue, t, label),
        });
        setErrors(result.errors);
        setFormError(result.formError);

        const firstInvalid = fields.find((f) => result.errors[f.name]);
        if (firstInvalid || result.formError) {
            onInvalid?.({ errors: result.errors, formError: result.formError, firstInvalid: firstInvalid?.name });
            // Focus sau một frame: onInvalid có thể vừa làm trường lỗi hiện ra (đổi tab).
            if (firstInvalid && idPrefix) {
                requestAnimationFrame(() => document.getElementById(`${idPrefix}-${firstInvalid.name}`)?.focus());
            }
            return;
        }

        setSubmitting(true);
        try {
            await onValid(result.data);
            if (resetOnSuccess) reset();
        } catch (err) {
            if (onSubmitError) onSubmitError(err);
            else toast.error(getErrorMessage(err, t));
        } finally {
            setSubmitting(false);
        }
    };

    return { values, errors, formError, submitting, setValue, setError, setValues, reset, handleSubmit };
}
