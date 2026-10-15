import './form.css';

/**
 * Một ô tích, nhãn nằm bên phải. `onChange` nhận boolean.
 *
 *   <Checkbox id="active" checked={active} onChange={setActive}>{t('...')}</Checkbox>
 */
export default function Checkbox({ id, name, checked, onChange, disabled = false, describedBy, children, className = '' }) {
    return (
        <label className={['checkbox-option', disabled ? 'is-disabled' : '', className].filter(Boolean).join(' ')} htmlFor={id}>
            <input
                id={id}
                name={name ?? id}
                type="checkbox"
                checked={!!checked}
                onChange={(e) => onChange?.(e.target.checked)}
                disabled={disabled}
                aria-describedby={describedBy}
            />
            <span>{children}</span>
        </label>
    );
}
