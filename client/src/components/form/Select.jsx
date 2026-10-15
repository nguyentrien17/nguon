import { useTranslation } from 'react-i18next';
import './form.css';

const toOption = (opt) => (typeof opt === 'object' && opt !== null ? opt : { value: opt, label: String(opt) });

/**
 * Dropdown chọn một giá trị.
 *
 *   <Select id="parent" value={parentId} onChange={setParentId}
 *           options={modules.map((m) => ({ value: m.id, label: m.module_name }))} />
 *   <Select options={['SUCCESS', 'FAILURE']} placeholder={t('auditLogs.allStatuses')} ... />
 *
 * - `options`: mảng { value, label, disabled? } hoặc mảng giá trị đơn.
 * - `onChange` trả về ĐÚNG kiểu của option.value (number vẫn là number — thẻ <select> gốc luôn
 *   trả về chuỗi), hoặc '' khi chọn dòng placeholder.
 * - `placeholder`: chuỗi cho dòng đầu (value ''); mặc định "-- Chọn --"; `false` để bỏ hẳn.
 */
export default function Select({ id, name, value, onChange, options = [], placeholder, invalid = false, required = false, describedBy, className = '', ...rest }) {
    const { t } = useTranslation();
    const opts = options.map(toOption);
    const selectedIndex = opts.findIndex((o) => o.value === value);
    const showPlaceholder = placeholder !== false;

    const handleChange = (e) => {
        const raw = e.target.value;
        onChange?.(raw === '' ? '' : opts[Number(raw)].value);
    };

    return (
        <select
            id={id}
            name={name ?? id}
            className={['input', 'select', invalid ? 'is-invalid' : '', className].filter(Boolean).join(' ')}
            value={selectedIndex === -1 ? '' : String(selectedIndex)}
            onChange={handleChange}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            aria-describedby={describedBy}
            {...rest}
        >
            {showPlaceholder && <option value="">{placeholder ?? t('form.selectPlaceholder')}</option>}
            {opts.map((o, i) => (
                <option key={`${String(o.value)}-${i}`} value={String(i)} disabled={o.disabled}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}
