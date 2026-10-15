import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Cảnh báo cấu hình: action chưa cấp cho role nào, module rỗng, role chưa gán cho ai.
 * Không hiện gì khi không có cảnh báo.
 */
export default function InsightsPanel({ insights }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { unusedActions = [], emptyModules = [], unusedRoles = [] } = insights || {};
    const total = unusedActions.length + emptyModules.length + unusedRoles.length;
    if (total === 0) return null;

    return (
        <div className="insights-panel">
            <button type="button" className="insights-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                <AlertTriangle size={15} aria-hidden="true" />
                {t('moduleActions.insightsTitle')} ({total})
                {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            </button>
            {open && (
                <div className="insights-body">
                    {unusedActions.length > 0 && (
                        <div>
                            <strong>{t('moduleActions.insightsUnusedActions')}</strong>:{' '}
                            {unusedActions.map((a) => `${a.module_code}:${a.action_code}`).join(', ')}
                        </div>
                    )}
                    {emptyModules.length > 0 && (
                        <div>
                            <strong>{t('moduleActions.insightsEmptyModules')}</strong>: {emptyModules.map((m) => m.module_code).join(', ')}
                        </div>
                    )}
                    {unusedRoles.length > 0 && (
                        <div>
                            <strong>{t('moduleActions.insightsUnusedRoles')}</strong>: {unusedRoles.map((r) => r.permission_code).join(', ')}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
