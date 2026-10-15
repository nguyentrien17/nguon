import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, DataTable, Pagination } from '@/components/ui';
import usePagedList from '@/hooks/usePagedList';
import { AUDIT_STATUS } from '@shared/constants.json';
import { listAuditActions, listAuditLogs } from './auditLogApi';

export default function AuditLogs() {
    const { t } = useTranslation();
    const list = usePagedList(listAuditLogs, { limit: 20, initialFilters: { action: '', status: '' } });
    const [actionTypes, setActionTypes] = useState([]);

    useEffect(() => {
        listAuditActions()
            .then((res) => setActionTypes(res.data))
            .catch(() => {});
    }, []);

    const columns = [
        { key: 'created_at', header: t('auditLogs.columns.time'), render: (log) => new Date(log.created_at).toLocaleString() },
        { key: 'username', header: t('auditLogs.columns.user') },
        { key: 'action', header: t('auditLogs.columns.action') },
        { key: 'ip_address', header: t('auditLogs.columns.ip') },
        {
            key: 'status',
            header: t('auditLogs.columns.status'),
            render: (log) => <Badge tone={log.status === AUDIT_STATUS.SUCCESS ? 'success' : 'danger'}>{log.status}</Badge>,
        },
        { key: 'detail', header: t('auditLogs.columns.detail'), className: 'audit-detail-cell' },
    ];

    return (
        <div className="page">
            <div className="page-header">
                <h1>{t('auditLogs.title')}</h1>
            </div>

            <div className="search-bar">
                <select
                    value={list.filters.action}
                    onChange={(e) => list.applyFilters({ action: e.target.value })}
                    aria-label={t('auditLogs.columns.action')}
                >
                    <option value="">{t('auditLogs.allActions')}</option>
                    {actionTypes.map((a) => (
                        <option key={a} value={a}>
                            {a}
                        </option>
                    ))}
                </select>
                <select
                    value={list.filters.status}
                    onChange={(e) => list.applyFilters({ status: e.target.value })}
                    aria-label={t('auditLogs.columns.status')}
                >
                    <option value="">{t('auditLogs.allStatuses')}</option>
                    <option value={AUDIT_STATUS.SUCCESS}>{AUDIT_STATUS.SUCCESS}</option>
                    <option value={AUDIT_STATUS.FAILURE}>{AUDIT_STATUS.FAILURE}</option>
                </select>
            </div>

            <DataTable columns={columns} rows={list.rows} loading={list.loading} emptyMessage={t('auditLogs.empty')} />

            <Pagination pagination={list.pagination} onChange={list.goToPage} disabled={list.loading} />
        </div>
    );
}
