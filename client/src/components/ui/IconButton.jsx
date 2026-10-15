import Spinner from './Spinner';
import './ui.css';

/**
 * Nút chỉ có icon (thao tác trên từng dòng của bảng...).
 *
 *   <IconButton icon={Pencil} label={t('users.edit')} onClick={...} />
 *
 * `label` là BẮT BUỘC: nó vừa là tooltip (title) vừa là aria-label — nút không có chữ mà thiếu
 * nhãn thì trình đọc màn hình chỉ đọc được "button".
 */
export default function IconButton({ icon: Icon, label, tone = 'default', loading = false, disabled = false, className = '', ...rest }) {
    const classes = ['icon-btn', tone === 'danger' ? 'icon-btn-danger' : '', className].filter(Boolean).join(' ');
    return (
        <button
            type="button"
            className={classes}
            title={label}
            aria-label={label}
            disabled={disabled || loading}
            {...rest}
        >
            {loading ? <Spinner size={14} /> : <Icon size={16} aria-hidden="true" />}
        </button>
    );
}
