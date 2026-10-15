import './form.css';

/**
 * Nhãn của một trường. `required` thêm dấu * (chỉ trang trí — trạng thái bắt buộc thật được
 * báo cho trình đọc màn hình qua aria-required trên control).
 */
export default function Label({ htmlFor, required = false, className = '', children }) {
    return (
        <label htmlFor={htmlFor} className={['field-label', className].filter(Boolean).join(' ')}>
            {children}
            {required && (
                <span className="field-required" aria-hidden="true">
                    *
                </span>
            )}
        </label>
    );
}
