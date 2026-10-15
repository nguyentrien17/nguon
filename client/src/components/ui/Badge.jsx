import './ui.css';

// success/danger/neutral dùng lại class badge-* có sẵn trong App.css để giữ nguyên giao diện.
const TONE_CLASS = {
    success: 'badge-active',
    danger: 'badge-locked',
    neutral: 'badge-archived',
    info: 'badge-info',
    warning: 'badge-warning',
};

/**
 * Nhãn trạng thái nhỏ.
 *
 *   <Badge tone={isActive ? 'success' : 'danger'}>{label}</Badge>
 */
export default function Badge({ tone = 'neutral', className = '', children }) {
    return <span className={['badge', TONE_CLASS[tone] || TONE_CLASS.neutral, className].filter(Boolean).join(' ')}>{children}</span>;
}
