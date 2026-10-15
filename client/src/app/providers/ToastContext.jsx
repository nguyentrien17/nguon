import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, XCircle, Info, X } from 'lucide-react';
import '@/components/ui/ui.css';

const ToastContext = createContext(null);

const ICONS = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

// Lỗi ở lâu hơn: người dùng cần thời gian đọc nguyên nhân.
const DEFAULT_DURATION = { success: 3500, info: 3500, warning: 5000, error: 6000 };
// Quá số này thì bỏ toast cũ nhất — một vòng lặp lỗi không được phủ kín màn hình.
const MAX_VISIBLE = 5;

/**
 * Thông báo nổi góc màn hình, tự ẩn.
 *
 *   const toast = useToast();
 *   toast.success(t('users.saved'));
 *   toast.error(getErrorMessage(err, t));
 *   toast.warning(msg, 0);            // duration 0 = không tự ẩn, chỉ đóng bằng tay
 *   const id = toast.info(msg); toast.dismiss(id);
 *
 * Object `toast` giữ nguyên tham chiếu giữa các lần render — đưa vào deps của useEffect/
 * useCallback thoải mái. Thông báo cần nằm lại trong trang thì dùng <Alert> thay vì toast.
 */
export function ToastProvider({ children }) {
    const { t } = useTranslation();
    const [toasts, setToasts] = useState([]);
    const counter = useRef(0);
    const timers = useRef(new Map());

    const dismiss = useCallback((id) => {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        setToasts((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const show = useCallback(
        (message, type = 'info', duration = DEFAULT_DURATION[type] ?? 3500) => {
            const id = ++counter.current;
            setToasts((prev) => [...prev, { id, message, type }].slice(-MAX_VISIBLE));
            if (duration > 0) {
                timers.current.set(id, setTimeout(() => dismiss(id), duration));
            }
            return id;
        },
        [dismiss]
    );

    useEffect(() => {
        const pending = timers.current;
        return () => pending.forEach((timer) => clearTimeout(timer));
    }, []);

    const toast = useMemo(
        () => ({
            success: (msg, duration) => show(msg, 'success', duration),
            error: (msg, duration) => show(msg, 'error', duration),
            warning: (msg, duration) => show(msg, 'warning', duration),
            info: (msg, duration) => show(msg, 'info', duration),
            dismiss,
        }),
        [show, dismiss]
    );

    return (
        <ToastContext.Provider value={toast}>
            {children}
            {/* aria-live: trình đọc màn hình đọc toast mới mà không cần chuyển focus. */}
            <div className="toast-stack" aria-live="polite">
                {toasts.map((item) => {
                    const Icon = ICONS[item.type] || Info;
                    return (
                        <div
                            key={item.id}
                            className={`toast toast-${item.type}`}
                            role={item.type === 'error' || item.type === 'warning' ? 'alert' : 'status'}
                        >
                            <Icon size={18} aria-hidden="true" />
                            <span>{item.message}</span>
                            <button type="button" onClick={() => dismiss(item.id)} aria-label={t('common.dismiss')}>
                                <X size={14} aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
