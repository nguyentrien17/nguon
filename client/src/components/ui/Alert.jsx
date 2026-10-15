import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import './ui.css';

const ICONS = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
};

/**
 * Thông báo NẰM TRONG trang (khác Toast — tự biến mất sau vài giây ở góc màn hình).
 * Dùng khi thông báo gắn với một vùng cụ thể và người dùng cần đọc kỹ: lỗi của form, cảnh báo
 * trước thao tác, kết quả cần giữ lại trên màn hình.
 *
 *   <Alert tone="error" title="Không lưu được">{message}</Alert>
 *   <Alert tone="info" onDismiss={() => setShow(false)}>...</Alert>
 */
export default function Alert({ tone = 'info', title, onDismiss, className = '', children }) {
    const { t } = useTranslation();
    const Icon = ICONS[tone] || Info;
    // error/warning cần được đọc ngay (role="alert"); info/success thì không cắt ngang.
    const role = tone === 'error' || tone === 'warning' ? 'alert' : 'status';

    return (
        // alert-tone-* (không phải alert-*): App.css đã có .alert-error riêng cho trang đăng nhập.
        <div className={['alert', `alert-tone-${tone}`, className].filter(Boolean).join(' ')} role={role}>
            <Icon size={18} className="alert-icon" aria-hidden="true" />
            <div className="alert-body">
                {title && <div className="alert-title">{title}</div>}
                {children && <div className="alert-message">{children}</div>}
            </div>
            {onDismiss && (
                <button type="button" className="alert-dismiss" onClick={onDismiss} aria-label={t('common.dismiss')}>
                    <X size={14} aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
