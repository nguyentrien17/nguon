import { useId } from 'react';
import FormField from './FormField';
import Input from './Input';
import Textarea from './Textarea';
import Select from './Select';
import Checkbox from './Checkbox';
import CheckboxGroup from './CheckboxGroup';
import FileInput from './FileInput';
import { describedBy as describe } from './formUtils';

/**
 * Một trường hoàn chỉnh (nhãn + control + gợi ý + lỗi) theo `type`. Dùng khi tự dựng form mà
 * vẫn muốn giao diện chung; <Form> cũng render từng trường qua component này.
 *
 *   <Field name="email" type="email" label={t('...')} required value={v} onChange={setV} error={err} />
 *   <Field name="role" type="select" label=... options={[...]} value=... onChange=... />
 *
 * type: text | email | password | number | date | tel | url | textarea | select | checkbox |
 *       checkboxes | file
 * Các prop còn lại (placeholder, autoComplete, rows, accept, multiple, maxSize, min, max...)
 * được chuyển thẳng xuống control.
 *
 * Control tuỳ biến (không thuộc các type trên, vd bộ chọn icon): truyền `render`
 *   render={({ id, value, onChange, disabled, invalid, describedBy }) => <IconPicker ... />}
 * Field vẫn lo nhãn / gợi ý / lỗi như mọi trường khác.
 */
export default function Field({
    id: idProp,
    name,
    type = 'text',
    label,
    required = false,
    hint,
    error,
    span,
    value,
    onChange,
    onReject,
    options,
    placeholder,
    emptyMessage,
    disabled = false,
    className,
    render,
    ...controlProps
}) {
    const autoId = useId();
    const id = idProp || `${name || 'field'}-${autoId}`;
    const common = {
        id,
        disabled,
        invalid: !!error,
        describedBy: describe(id, { hint, error }),
    };

    let control;
    if (render) {
        control = render({ ...common, name, value, onChange });
    } else switch (type) {
        case 'textarea':
            control = <Textarea {...common} name={name} value={value} onChange={onChange} required={required} placeholder={placeholder} {...controlProps} />;
            break;
        case 'select':
            control = <Select {...common} name={name} value={value} onChange={onChange} required={required} options={options} placeholder={placeholder} {...controlProps} />;
            break;
        case 'checkbox':
            control = (
                <Checkbox id={id} name={name} checked={value} onChange={onChange} disabled={disabled} describedBy={common.describedBy}>
                    {label}
                </Checkbox>
            );
            break;
        case 'checkboxes':
            control = <CheckboxGroup {...common} value={value} onChange={onChange} options={options} emptyMessage={emptyMessage} />;
            break;
        case 'file':
            control = <FileInput {...common} value={value} onChange={onChange} onReject={onReject} {...controlProps} />;
            break;
        default:
            control = <Input {...common} name={name} type={type} value={value} onChange={onChange} required={required} placeholder={placeholder} {...controlProps} />;
    }

    return (
        <FormField
            id={id}
            label={label}
            required={required}
            hint={hint}
            error={error}
            span={span}
            hideLabel={type === 'checkbox'}
            className={className}
        >
            {control}
        </FormField>
    );
}
