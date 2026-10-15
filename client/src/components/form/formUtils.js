// Hàm thuần dùng chung cho Form/useForm — tách khỏi file .jsx để test được và không vi phạm
// react-refresh/only-export-components.

// id của dòng gợi ý / lỗi, để control trỏ tới qua aria-describedby.
export const hintId = (id) => `${id}-hint`;
export const errorId = (id) => `${id}-error`;

export function describedBy(id, { hint, error }) {
    if (error) return errorId(id);
    if (hint) return hintId(id);
    return undefined;
}

export const isHidden = (field, values) => (typeof field.hidden === 'function' ? field.hidden(values) : !!field.hidden);

/**
 * Validate toàn bộ form — hàm thuần, useForm gọi khi submit (tách ra để test được không cần DOM).
 *
 *   1. Bỏ trường đang ẩn; '' -> undefined.
 *   2. Trường bắt buộc (field.required, hoặc suy từ schema) mà trống -> validation.required.
 *   3. schema.safeParse: lỗi gắn đúng trường; lỗi không thuộc trường đang hiện (refine...) -> formError.
 *   4. validate(data) tuỳ chọn, chỉ chạy khi 1–3 không có lỗi: { tênTrường: msg, _form: msg }.
 *
 * `translateIssue(issue, label)` dịch một issue zod (truyền từ ngoài vào để file này không phụ
 * thuộc i18n). Trả về { errors, formError, data } — data đã qua schema (trim, default...) và giữ
 * cả trường ngoài schema (confirmPassword, file...).
 */
export function validateForm({ fields, values, schema, validate, t, translateIssue }) {
    const visible = fields.filter((f) => !isHidden(f, values));
    const visibleNames = new Set(visible.map((f) => f.name));
    const fieldNames = new Set(fields.map((f) => f.name));
    const labelOf = (name) => fields.find((f) => f.name === name)?.label ?? String(name);
    // Giữ key không phải field (vd id có trong initialValues), bỏ field đang ẩn.
    const data = compactValues(Object.fromEntries(Object.entries(values).filter(([k]) => !fieldNames.has(k) || visibleNames.has(k))));

    const errors = {};
    let formError = null;

    for (const f of visible) {
        const required = f.required ?? isRequiredBySchema(schema, f.name);
        if (required && isEmpty(data[f.name])) errors[f.name] = t('validation.required', { field: f.label ?? f.name });
    }

    let parsed = data;
    if (schema) {
        const result = schema.safeParse(data);
        if (result.success) {
            parsed = { ...data, ...result.data };
        } else {
            for (const issue of result.error.issues) {
                const name = issue.path[0];
                if (name !== undefined && visibleNames.has(name)) {
                    errors[name] ??= translateIssue(issue, labelOf(name));
                } else {
                    formError ??= translateIssue(issue, name === undefined ? '' : labelOf(name));
                }
            }
        }
    }

    if (validate && Object.keys(errors).length === 0 && !formError) {
        const custom = validate(parsed) || {};
        for (const [name, message] of Object.entries(custom)) {
            if (!message) continue;
            if (name === '_form') formError = message;
            else errors[name] ??= message;
        }
    }

    return { errors, formError, data: parsed };
}

// Khai báo field dạng chuỗi ('email') được mở rộng thành object; type suy từ tên.
export function normalizeField(field) {
    const def = typeof field === 'string' ? { name: field } : { ...field };
    if (!def.type) def.type = inferType(def.name);
    return def;
}

export function inferType(name = '') {
    const n = name.toLowerCase();
    if (n.includes('password')) return 'password';
    if (n.includes('email')) return 'email';
    return 'text';
}

export function emptyValueFor(type) {
    switch (type) {
        case 'checkbox':
            return false;
        case 'checkboxes':
            return [];
        case 'file':
            return null;
        default:
            return '';
    }
}

export function buildInitialValues(fields, initialValues = {}) {
    const values = {};
    for (const f of fields) values[f.name] = initialValues[f.name] ?? emptyValueFor(f.type);
    // Giữ cả các key không có field tương ứng (vd id) để caller đọc lại được.
    return { ...initialValues, ...values };
}

// Trường có bắt buộc theo schema zod không: parse thử undefined. Schema không phải z.object
// (không có .shape) hoặc không khai báo trường đó -> không suy được, coi như không bắt buộc.
export function isRequiredBySchema(schema, name) {
    const fieldSchema = schema?.shape?.[name];
    if (!fieldSchema) return false;
    return !fieldSchema.safeParse(undefined).success;
}

export function isEmpty(value) {
    return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

// Bỏ hẳn key có giá trị '' / undefined trước khi validate: trường optional bỏ trống thì KHÔNG
// gửi lên (vd ô mật khẩu "để trống nếu giữ nguyên"), trường bắt buộc bỏ trống báo "bắt buộc"
// thay vì "quá ngắn". Phải XOÁ key chứ không chỉ gán undefined — schema kiểu
// .refine((d) => Object.keys(d).length > 0) đếm cả key mang giá trị undefined.
export function compactValues(values) {
    return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v !== undefined));
}

// accept kiểu thẻ <input accept>: '.xlsx,.csv,image/*,application/pdf'
export function fileMatchesAccept(file, accept) {
    if (!accept) return true;
    const name = file.name.toLowerCase();
    const type = (file.type || '').toLowerCase();
    return accept
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .some((rule) => {
            if (rule.startsWith('.')) return name.endsWith(rule);
            if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
            return type === rule;
        });
}

export function omitKeys(obj, keys) {
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
}

export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
