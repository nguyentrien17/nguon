import Label from './Label';
import { errorId, hintId } from './formUtils';
import './form.css';

/**
 * Khung của một trường: nhãn, control, gợi ý, lỗi.
 *
 *   <FormField id="email" label="Email" required error={errors.email} hint="...">
 *       <Input id="email" value={...} onChange={...} invalid={!!errors.email}
 *              describedBy={describedBy('email', { hint: true, error: errors.email })} />
 *   (describedBy import từ './formUtils')
 *   </FormField>
 *
 * Thường không cần dùng trực tiếp — <Field> hoặc <Form> đã ghép sẵn.
 */
export default function FormField({ id, label, required = false, hint, error, span, hideLabel = false, className = '', children }) {
    const classes = ['form-field', span === 2 || span === 'full' ? 'form-span-2' : '', error ? 'has-error' : '', className]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes}>
            {label && !hideLabel && (
                <Label htmlFor={id} required={required}>
                    {label}
                </Label>
            )}
            {children}
            {hint && !error && (
                <div id={hintId(id)} className="field-hint">
                    {hint}
                </div>
            )}
            {error && (
                <div id={errorId(id)} className="field-error" role="alert">
                    {error}
                </div>
            )}
        </div>
    );
}
