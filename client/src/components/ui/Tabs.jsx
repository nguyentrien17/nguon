import './ui.css';

/**
 * Thanh tab. Nội dung từng tab do caller tự render theo `active`.
 *
 *   <Tabs tabs={[{ key: 'info', label: '1. Thông tin' }, { key: 'perm', label: '2. Phân quyền' }]}
 *         active={tab} onChange={setTab} />
 *
 * `tab.badge` (tuỳ chọn) hiện số nhỏ cạnh nhãn, vd số lỗi trong tab đó.
 */
export default function Tabs({ tabs, active, onChange, className = '' }) {
    return (
        <div className={['tabs', className].filter(Boolean).join(' ')} role="tablist">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={tab.key === active}
                    className={tab.key === active ? 'active' : ''}
                    onClick={() => onChange(tab.key)}
                >
                    {tab.label}
                    {tab.badge ? <span className="tabs-badge">{tab.badge}</span> : null}
                </button>
            ))}
        </div>
    );
}
