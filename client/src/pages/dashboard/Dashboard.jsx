import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, ShieldCheck, LayoutGrid, Activity } from 'lucide-react';
import axiosClient from '@/api/axiosClient';
import { useAuth } from '@/context/AuthContext';
import StatCard from './StatCard';
import { MODULE_CODE, ACTION_CODE } from '@shared/constants.json';

export default function Dashboard() {
    const { t } = useTranslation();
    const { user, can } = useAuth();
    const [stats, setStats] = useState({ users: null, roles: null, modules: null });

    useEffect(() => {
        (async () => {
            const requests = [];

            requests.push(
                can(MODULE_CODE.USER, ACTION_CODE.VIEW)
                    ? axiosClient.get('/users', { params: { page: 1, limit: 1 } }).then((r) => r.data.pagination.total).catch(() => null)
                    : Promise.resolve(null)
            );
            requests.push(
                can(MODULE_CODE.PERMISSION, ACTION_CODE.VIEW)
                    ? axiosClient.get('/permissions').then((r) => r.data.data.length).catch(() => null)
                    : Promise.resolve(null)
            );
            requests.push(axiosClient.get('/modules').then((r) => r.data.data.length).catch(() => null));

            const [users, roles, modules] = await Promise.all(requests);
            setStats({ users, roles, modules });
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="page">
            <h1>{t('dashboard.welcome', { name: user?.full_name })}</h1>

            <div className="stat-grid">
                {stats.users !== null && (
                    <StatCard icon={Users} label={t('nav.users')} value={stats.users} tone="indigo" />
                )}
                {stats.roles !== null && (
                    <StatCard icon={ShieldCheck} label={t('nav.permissions')} value={stats.roles} tone="green" />
                )}
                {stats.modules !== null && (
                    <StatCard icon={LayoutGrid} label="Modules" value={stats.modules} tone="amber" />
                )}
                <StatCard icon={Activity} label="Status" value="Online" tone="sky" />
            </div>
        </div>
    );
}
