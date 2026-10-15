import { useId } from 'react';
import useEscapeKey from '@/hooks/useEscapeKey';
import './ui.css';

/**
 * Hộp thoại dùng chung: backdrop, tiêu đề, nội dung, hàng nút cuối.
 *
 *   <Modal open={formOpen} title={t('users.create')} onClose={close} busy={saving}
 *          as="form" onSubmit={handleSave}
 *          footer={<>
 *              <Button onClick={close} disabled={saving}>{t('common.cancel')}</Button>
 *              <Button type="submit" variant="primary" loading={saving}>{t('common.save')}</Button>
 *          </>}>
 *       ...các trường của form...
 *   </Modal>
 *
 * - Đóng khi bấm ra ngoài hoặc bấm Escape — TRỪ khi `busy` (đang lưu), để không mất dữ liệu
 *   giữa chừng.
 * - `as="form"`: chính hộp thoại là <form>, Enter trong ô nhập sẽ submit.
 * - `size="wide"`: hộp rộng (680px) cho nội dung nhiều cột.
 * - Xác nhận có/không thì dùng ConfirmDialog thay vì tự dựng bằng Modal.
 */
export default function Modal({ open, title, onClose, busy = false, as = 'div', onSubmit, size = 'default', footer, className = '', children }) {
    const titleId = useId();
    const requestClose = () => {
        if (!busy) onClose?.();
    };
    useEscapeKey(requestClose, open);

    if (!open) return null;

    const Card = as === 'form' ? 'form' : 'div';
    const cardClass = ['modal-card', size === 'wide' ? 'modal-card-wide' : '', className].filter(Boolean).join(' ');

    return (
        <div className="modal-backdrop" onClick={requestClose}>
            <Card
                className={cardClass}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                onClick={(e) => e.stopPropagation()}
                onSubmit={as === 'form' ? onSubmit : undefined}
            >
                {title && <h2 id={titleId}>{title}</h2>}
                {children}
                {footer && <div className="modal-actions">{footer}</div>}
            </Card>
        </div>
    );
}
