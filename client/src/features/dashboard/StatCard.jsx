export default function StatCard({ icon: Icon, label, value, tone = 'indigo' }) {
    return (
        <div className="stat-card">
            <div className={`stat-icon stat-icon-${tone}`}>
                <Icon size={20} />
            </div>
            <div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
            </div>
        </div>
    );
}
