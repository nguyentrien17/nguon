import { useTranslation } from 'react-i18next';
import './form.css';

const toOption = (opt) => (typeof opt === 'object' && opt !== null ? opt : { value: opt, label: String(opt) });

/**
 * Chọn NHIỀU giá trị bằng danh sách ô tích (vd gán nhiều role). `value` là mảng, `onChange`
 * nhận mảng mới; thứ tự giữ theo thứ tự của `options`.
 *
 *   <CheckboxGroup id="roles" value={roleIds} onChange={setRoleIds}
 *                  options={roles.map((r) => ({ value: r.id, label: r.permission_name, hint: r.permission_code }))} />
 */
export default function CheckboxGroup({ id, value = [], onChange, options = [], disabled = false, invalid = false, describedBy, emptyMessage }) {
    const { t } = useTranslation();
    const opts = options.map(toOption);
    const selected = new Set(value);

    const toggle = (optValue) => {
        const next = new Set(selected);
        if (next.has(optValue)) next.delete(optValue);
        else next.add(optValue);
        onChange?.(opts.map((o) => o.value).filter((v) => next.has(v)));
    };

    return (
        <ul id={id} className={['checkbox-group', invalid ? 'is-invalid' : ''].filter(Boolean).join(' ')} role="group" aria-describedby={describedBy}>
            {opts.map((o, i) => (
                <li key={`${String(o.value)}-${i}`}>
                    <label className="checkbox-option">
                        <input
                            type="checkbox"
                            checked={selected.has(o.value)}
                            onChange={() => toggle(o.value)}
                            disabled={disabled || o.disabled}
                        />
                        <span>
                            {o.label}
                            {o.hint && <span className="checkbox-option-hint"> ({o.hint})</span>}
                        </span>
                    </label>
                </li>
            ))}
            {opts.length === 0 && <li className="checkbox-group-empty">{emptyMessage || t('common.noData')}</li>}
        </ul>
    );
}
