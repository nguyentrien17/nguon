import { MODULE_ICON_MAP, MODULE_ICON_OPTIONS } from '@/constants/moduleIcons';

/**
 * Chọn icon cho module. Bấm lại icon đang chọn để bỏ chọn (value = '').
 * Dùng làm control tuỳ biến của <Form> qua `render`.
 */
export default function IconPicker({ id, value, onChange, disabled = false, describedBy }) {
    return (
        <div id={id} className="icon-picker" role="group" aria-describedby={describedBy}>
            {MODULE_ICON_OPTIONS.map((name) => {
                const IconComp = MODULE_ICON_MAP[name];
                const active = value === name;
                return (
                    <button
                        key={name}
                        type="button"
                        title={name}
                        aria-label={name}
                        aria-pressed={active}
                        disabled={disabled}
                        className={`icon-picker-btn${active ? ' icon-picker-btn-active' : ''}`}
                        onClick={() => onChange(active ? '' : name)}
                    >
                        <IconComp size={16} aria-hidden="true" />
                    </button>
                );
            })}
        </div>
    );
}
