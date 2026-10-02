import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default', onConfirm, onCancel }) {
    if (!open) return null;

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
                <div className={`confirm-icon confirm-icon-${tone}`}>
                    <AlertTriangle size={20} />
                </div>
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="modal-actions">
                    <button type="button" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button type="button" className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
