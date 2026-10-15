import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, ShieldCheck, LayoutGrid, Activity } from 'lucide-react';
import { useAuth } from '@/core/auth/AuthContext';
import StatCard from './StatCard';
import { MODULE_CODE, ACTION_CODE } from '@shared/constants.json';
import { countModules, countRoles, countUsers } from './dashboardApi';

// Thẻ nào lỗi / không có quyền xem thì ẩn (null), không chặn các thẻ khác.
const orNull = (promise) => promise.catch(() => null);

export default function Dashboard() {
    const { t } = useTranslation();
    const { user, can } = useAuth();
    const [stats, setStats] = useState({ users: null, roles: null, modules: null });

    useEffect(() => {
        (async () => {
            const [users, roles, modules] = await Promise.all([
                can(MODULE_CODE.USER, ACTION_CODE.VIEW) ? orNull(countUsers()) : null,
                can(MODULE_CODE.PERMISSION, ACTION_CODE.VIEW) ? orNull(countRoles()) : null,
                orNull(countModules()),
            ]);
            setStats({ users, roles, modules });
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="page">
            <h1>{t('dashboard.welcome', { name: user?.full_name })}</h1>

            <div className="stat-grid">
                {stats.users !== null && <StatCard icon={Users} label={t('nav.users')} value={stats.users} tone="indigo" />}
                {stats.roles !== null && <StatCard icon={ShieldCheck} label={t('nav.permissions')} value={stats.roles} tone="green" />}
                {stats.modules !== null && <StatCard icon={LayoutGrid} label={t('dashboard.modules')} value={stats.modules} tone="amber" />}
                <StatCard icon={Activity} label={t('dashboard.status')} value={t('dashboard.online')} tone="sky" />
            </div>
        </div>
    );
}
