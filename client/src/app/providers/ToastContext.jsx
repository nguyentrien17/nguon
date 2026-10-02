import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const counter = useRef(0);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback(
        (message, type = 'info', duration = 3500) => {
            const id = ++counter.current;
            setToasts((prev) => [...prev, { id, message, type }]);
            if (duration > 0) {
                setTimeout(() => removeToast(id), duration);
            }
            return id;
        },
        [removeToast]
    );

    const toast = {
        success: (msg, duration) => showToast(msg, 'success', duration),
        error: (msg, duration) => showToast(msg, 'error', duration),
        info: (msg, duration) => showToast(msg, 'info', duration),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toast-stack">
                {toasts.map((t) => {
                    const Icon = ICONS[t.type] || Info;
                    return (
                        <div key={t.id} className={`toast toast-${t.type}`}>
                            <Icon size={18} />
                            <span>{t.message}</span>
                            <button type="button" onClick={() => removeToast(t.id)} aria-label="Dismiss">
                                <X size={14} />
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
