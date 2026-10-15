import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import useEscapeKey from '@/hooks/useEscapeKey';

/**
 * Hộp thoại xác nhận có/không.
 *
 *   <ConfirmDialog open={!!target} title=... message=... tone="danger"
 *                  onConfirm={doIt} onCancel={() => setTarget(null)} loading={working} />
 *
 * `loading`: khoá cả hai nút và chặn đóng trong lúc thao tác đang chạy. Nhãn nút mặc định lấy
 * từ i18n (common.confirm / common.cancel).
 */
export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, tone = 'default', loading = false, onConfirm, onCancel }) {
    const { t } = useTranslation();
    const titleId = useId();
    const requestCancel = () => {
        if (!loading) onCancel?.();
    };
    useEscapeKey(requestCancel, open);

    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={requestCancel}>
            <div
                className="confirm-card"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`confirm-icon confirm-icon-${tone}`}>
                    <AlertTriangle size={20} aria-hidden="true" />
                </div>
                <h3 id={titleId}>{title}</h3>
                <p>{message}</p>
                <div className="modal-actions">
                    <Button onClick={requestCancel} disabled={loading}>
                        {cancelLabel || t('common.cancel')}
                    </Button>
                    <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} autoFocus>
                        {confirmLabel || t('common.confirm')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
