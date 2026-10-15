import './form.css';

/** Ô nhập nhiều dòng. `onChange` nhận giá trị chuỗi. */
export default function Textarea({ id, name, value, onChange, invalid = false, required = false, describedBy, rows = 3, className = '', ...rest }) {
    return (
        <textarea
            id={id}
            name={name ?? id}
            rows={rows}
            className={['input', 'textarea', invalid ? 'is-invalid' : '', className].filter(Boolean).join(' ')}
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value)}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            aria-describedby={describedBy}
            {...rest}
        />
    );
}
