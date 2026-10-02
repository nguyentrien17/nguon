import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axiosClient from '@/core/api/axiosClient';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/app/providers/ToastContext';
import { AUDIT_STATUS } from '@shared/constants.json';
import { getErrorMessage } from '@/core/errors/errorMessage';

export default function AuditLogs() {
    const { t } = useTranslation();
    const toast = useToast();
    const [rows, setRows] = useState([]);
    const [actionTypes, setActionTypes] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
    const [actionFilter, setActionFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchLogs = useCallback(async (page, action, status) => {
        setLoading(true);
        try {
            const { data } = await axiosClient.get('/audit-logs', {
                params: { page, limit: 20, action: action || undefined, status: status || undefined },
            });
            setRows(data.data);
            setPagination(data.pagination);
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchLogs(1, '', '');
        axiosClient.get('/audit-logs/actions').then(({ data }) => setActionTypes(data.data)).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleFilterChange = (nextAction, nextStatus) => {
        setActionFilter(nextAction);
        setStatusFilter(nextStatus);
        fetchLogs(1, nextAction, nextStatus);
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>{t('auditLogs.title')}</h1>
            </div>

            <div className="search-bar">
                <select value={actionFilter} onChange={(e) => handleFilterChange(e.target.value, statusFilter)}>
                    <option value="">{t('auditLogs.allActions')}</option>
                    {actionTypes.map((a) => (
                        <option key={a} value={a}>
                            {a}
                        </option>
                    ))}
                </select>
                <select value={statusFilter} onChange={(e) => handleFilterChange(actionFilter, e.target.value)}>
                    <option value="">{t('auditLogs.allStatuses')}</option>
                    <option value={AUDIT_STATUS.SUCCESS}>{AUDIT_STATUS.SUCCESS}</option>
                    <option value={AUDIT_STATUS.FAILURE}>{AUDIT_STATUS.FAILURE}</option>
                </select>
            </div>

            <div className="table-wrap">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('auditLogs.columns.time')}</th>
                            <th>{t('auditLogs.columns.user')}</th>
                            <th>{t('auditLogs.columns.action')}</th>
                            <th>{t('auditLogs.columns.ip')}</th>
                            <th>{t('auditLogs.columns.status')}</th>
                            <th>{t('auditLogs.columns.detail')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((log) => (
                            <tr key={log.id}>
                                <td>{new Date(log.created_at).toLocaleString()}</td>
                                <td>{log.username || '—'}</td>
                                <td>{log.action}</td>
                                <td>{log.ip_address || '—'}</td>
                                <td>
                                    <span className={`badge ${log.status === AUDIT_STATUS.SUCCESS ? 'badge-active' : 'badge-locked'}`}>
                                        {log.status}
                                    </span>
                                </td>
                                <td className="audit-detail-cell">{log.detail || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {loading && (
                    <div className="table-overlay">
                        <Spinner size={24} />
                    </div>
                )}
                {!loading && rows.length === 0 && <EmptyState message="No audit logs found" />}
            </div>

            {pagination.totalPages > 1 && (
                <div className="pagination">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                            key={p}
                            type="button"
                            className={p === pagination.page ? 'active' : ''}
                            onClick={() => fetchLogs(p, actionFilter, statusFilter)}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
