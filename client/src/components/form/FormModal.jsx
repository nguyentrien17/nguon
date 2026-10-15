import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Form from './Form';

/**
 * <Modal> + <Form> ghép sẵn — dạng phổ biến nhất của form tạo/sửa.
 *
 *   <FormModal open={open} title={t('users.create')} onClose={close}
 *              layout="grid" fields={fields} schema={schema} initialValues={...}
 *              onSubmit={async (data) => { await api(data); onClose(); onSaved(); }} />
 *
 * - Mọi prop khác (fields, schema, initialValues, validate, layout, submitLabel, cancelLabel...)
 *   chuyển thẳng xuống <Form>; nút Huỷ gọi onClose.
 * - Trong lúc onSubmit chạy, hộp thoại KHÔNG đóng được bằng Escape / bấm ra ngoài.
 * - `open` mặc định true: phù hợp kiểu render có điều kiện {x && <FormModal ... />}.
 */
export default function FormModal({ open = true, title, onClose, size, onSubmit, ...formProps }) {
    const [busy, setBusy] = useState(false);

    const submit = async (data) => {
        setBusy(true);
        try {
            await onSubmit(data);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={open} title={title} onClose={onClose} busy={busy} size={size}>
            <Form {...formProps} onSubmit={submit} onCancel={onClose} actionsClassName="modal-actions" />
        </Modal>
    );
}
