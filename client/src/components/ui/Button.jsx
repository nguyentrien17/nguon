import Spinner from './Spinner';
import './ui.css';

const VARIANT_CLASS = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
};

/**
 * Nút chuẩn của ứng dụng.
 *
 *   <Button variant="primary" icon={Plus} onClick={...}>Tạo mới</Button>
 *   <Button type="submit" loading={saving}>Lưu</Button>
 *
 * - `loading`: hiện spinner thay icon và tự disable — không cần ghép tay {saving && <Spinner/>}.
 * - `type` mặc định là "button" (không phải "submit" như thẻ <button> gốc) để nút đặt trong
 *   <form> không vô tình submit form.
 */
export default function Button({
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    loading = false,
    disabled = false,
    type = 'button',
    className = '',
    children,
    ...rest
}) {
    const classes = [VARIANT_CLASS[variant] || VARIANT_CLASS.secondary, size === 'sm' ? 'btn-sm' : '', className]
        .filter(Boolean)
        .join(' ');
    const iconSize = size === 'sm' ? 14 : 16;

    return (
        <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
            {loading ? <Spinner size={iconSize - 2} /> : Icon && <Icon size={iconSize} aria-hidden="true" />}
            {children}
        </button>
    );
}
