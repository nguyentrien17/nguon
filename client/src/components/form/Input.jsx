import './form.css';

/**
 * Ô nhập một dòng: text, email, password, number, date, tel, url...
 *
 *   <Input id="email" type="email" value={email} onChange={setEmail} />
 *
 * `onChange` nhận GIÁ TRỊ, không phải event. type="number" trả về number, hoặc '' khi ô trống
 * (để form phân biệt được "chưa nhập" với số 0).
 */
export default function Input({ id, name, type = 'text', value, onChange, invalid = false, required = false, describedBy, className = '', ...rest }) {
    const handleChange = (e) => {
        const raw = e.target.value;
        onChange?.(type === 'number' ? (raw === '' ? '' : Number(raw)) : raw);
    };

    return (
        <input
            id={id}
            name={name ?? id}
            type={type}
            className={['input', invalid ? 'is-invalid' : '', className].filter(Boolean).join(' ')}
            value={value ?? ''}
            onChange={handleChange}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            aria-describedby={describedBy}
            {...rest}
        />
    );
}
