import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Archive,
    ChevronDown,
    ChevronRight,
    Copy,
    FolderTree,
    ListChecks,
    Lock,
    Package,
    Pencil,
    Plus,
    RotateCcw,
    Trash2,
    Unlock,
    Users,
    Zap,
} from 'lucide-react';
import ActionGuard from '@/core/permissions/ActionGuard';
import { EmptyState, IconButton, Spinner } from '@/components/ui';
import { MODULE_CODE, ACTION_CODE, RECORD_STATUS, MODULE_TYPE } from '@shared/constants.json';
import { MODULE_ICON_MAP } from '@/constants/moduleIcons';
import RecordStatusBadge from './RecordStatusBadge';

const COLUMN_COUNT = 9;

/**
 * Bảng cây module -> module con -> action, với thao tác trên từng dòng.
 *
 * - `tree`: createModuleTree(); `filter`: filterModuleTree(); `expanded` + `onToggleExpand`: các
 *   module đang mở (khi đang lọc thì mở hết để thấy kết quả).
 * - `handlers`: các callback thao tác — onCreateChild, onEditModule, onCreateAction, onScaffold,
 *   onClone, onToggleModuleStatus, onArchiveModule, onRestoreModule, onDeleteModule,
 *   onEditAction, onToggleActionStatus, onArchiveAction, onRestoreAction, onDeleteAction.
 * - `actionRoleMap`: { [actionId]: Role[] } để xem nhanh role nào đang có action đó.
 */
export default function ModuleTreeTable({ tree, filter, expanded, onToggleExpand, actionRoleMap = {}, handlers, loading }) {
    const { t } = useTranslation();
    const [roleLookupOpen, setRoleLookupOpen] = useState(new Set());
    const { isFiltering, actionMatches, moduleVisible } = filter;
    const can = { module: MODULE_CODE.MODULE_ACTION };

    const toggleRoleLookup = (id) =>
        setRoleLookupOpen((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const statusToggle = (record, onToggle) => (
        <IconButton
            icon={record.status === RECORD_STATUS.ACTIVE ? Lock : Unlock}
            label={record.status === RECORD_STATUS.ACTIVE ? t('moduleActions.lock') : t('moduleActions.unlock')}
            onClick={() => onToggle(record)}
        />
    );

    const renderAction = (a, depth) => {
        if (isFiltering && !actionMatches(a)) return null;
        const archived = a.status === RECORD_STATUS.ARCHIVED;
        const roles = actionRoleMap[a.id] || [];
        return (
            <Fragment key={`action-${a.id}`}>
                <tr className="tree-row tree-row-action">
                    <td>
                        <div className="tree-cell" style={{ paddingLeft: depth * 22 + 22 }}>
                            <Zap size={14} className="tree-icon-action" aria-hidden="true" />
                            <span className="tree-code">{a.action_code}</span>
                        </div>
                    </td>
                    <td>{a.action_name}</td>
                    <td className="tree-muted">—</td>
                    <td className="tree-muted">—</td>
                    <td className="tree-muted">—</td>
                    <td>
                        <RecordStatusBadge status={a.status} />
                    </td>
                    <td>
                        <span className="type-badge type-badge-action">{t('moduleActions.type.action')}</span>
                        {a.rate_limit_per_minute && (
                            <span className="type-badge type-badge-ratelimit">
                                {a.rate_limit_per_minute}/{t('moduleActions.perMinute')}
                            </span>
                        )}
                    </td>
                    <td className="tree-muted">{a.description || '—'}</td>
                    <td className="actions-cell">
                        <IconButton icon={Users} label={t('moduleActions.viewRoles')} onClick={() => toggleRoleLookup(a.id)} />
                        {!archived && (
                            <ActionGuard module={can.module} action={ACTION_CODE.EDIT}>
                                <IconButton icon={Pencil} label={t('moduleActions.edit')} onClick={() => handlers.onEditAction(a)} />
                                {statusToggle(a, handlers.onToggleActionStatus)}
                                <IconButton icon={Archive} label={t('moduleActions.archive')} onClick={() => handlers.onArchiveAction(a)} />
                            </ActionGuard>
                        )}
                        {archived && (
                            <ActionGuard module={can.module} action={ACTION_CODE.EDIT}>
                                <IconButton icon={RotateCcw} label={t('moduleActions.restore')} onClick={() => handlers.onRestoreAction(a)} />
                            </ActionGuard>
                        )}
                        {archived && (
                            <ActionGuard module={can.module} action={ACTION_CODE.DELETE}>
                                <IconButton icon={Trash2} label={t('moduleActions.delete')} tone="danger" onClick={() => handlers.onDeleteAction(a)} />
                            </ActionGuard>
                        )}
                    </td>
                </tr>
                {roleLookupOpen.has(a.id) && (
                    <tr className="tree-row">
                        <td colSpan={COLUMN_COUNT} className="role-lookup-cell">
                            {roles.length === 0
                                ? t('moduleActions.noRolesGranted')
                                : roles.map((r) => (
                                      <span key={r.id} className="role-chip">
                                          {r.permission_name}
                                      </span>
                                  ))}
                        </td>
                    </tr>
                )}
            </Fragment>
        );
    };

    const renderModule = (m, depth) => {
        if (!moduleVisible.get(m.id)) return null;
        const children = tree.childrenOf(m.id);
        const moduleActions = tree.actionsOf(m.id);
        const isOpen = expanded.has(m.id) || isFiltering;
        const archived = m.status === RECORD_STATUS.ARCHIVED;
        const ModuleIcon = MODULE_ICON_MAP[m.module_icon] || (depth === 0 ? Package : FolderTree);

        return (
            <Fragment key={m.id}>
                <tr className="tree-row tree-row-module">
                    <td>
                        <div className="tree-cell" style={{ paddingLeft: depth * 22 }}>
                            {children.length > 0 || moduleActions.length > 0 ? (
                                <button type="button" className="tree-toggle" onClick={() => onToggleExpand(m.id)} aria-expanded={isOpen}>
                                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            ) : (
                                <span className="tree-toggle-spacer" />
                            )}
                            <ModuleIcon size={15} className="tree-icon-module" aria-hidden="true" />
                            <span className="tree-code">{m.module_code}</span>
                        </div>
                    </td>
                    <td>{m.module_name}</td>
                    <td className="tree-muted">{m.module_href || '—'}</td>
                    <td className="tree-muted">{m.module_element_id || '—'}</td>
                    <td className="tree-muted">{m.module_index ?? 0}</td>
                    <td>
                        <RecordStatusBadge status={m.status} />
                    </td>
                    <td>
                        <span className={`type-badge ${m.module_type === MODULE_TYPE.SCREEN ? 'type-badge-screen' : 'type-badge-module'}`}>
                            {m.module_type === MODULE_TYPE.SCREEN ? t('moduleActions.type.screen') : t('moduleActions.type.menu')}
                        </span>
                    </td>
                    <td className="tree-muted">{m.description || '—'}</td>
                    <td className="actions-cell">
                        {!archived && (
                            <>
                                <ActionGuard module={can.module} action={ACTION_CODE.CREATE}>
                                    <IconButton icon={Plus} label={t('moduleActions.createChildModule')} onClick={() => handlers.onCreateChild(m)} />
                                </ActionGuard>
                                <ActionGuard module={can.module} action={ACTION_CODE.EDIT}>
                                    <IconButton icon={Pencil} label={t('moduleActions.edit')} onClick={() => handlers.onEditModule(m)} />
                                </ActionGuard>
                                <ActionGuard module={can.module} action={ACTION_CODE.CREATE}>
                                    <IconButton icon={Zap} label={t('moduleActions.createAction')} onClick={() => handlers.onCreateAction(m)} />
                                    <IconButton icon={ListChecks} label={t('moduleActions.scaffoldActions')} onClick={() => handlers.onScaffold(m)} />
                                    <IconButton icon={Copy} label={t('moduleActions.cloneModule')} onClick={() => handlers.onClone(m)} />
                                </ActionGuard>
                                <ActionGuard module={can.module} action={ACTION_CODE.EDIT}>
                                    {statusToggle(m, handlers.onToggleModuleStatus)}
                                    <IconButton icon={Archive} label={t('moduleActions.archive')} onClick={() => handlers.onArchiveModule(m)} />
                                </ActionGuard>
                            </>
                        )}
                        {archived && (
                            <ActionGuard module={can.module} action={ACTION_CODE.EDIT}>
                                <IconButton icon={RotateCcw} label={t('moduleActions.restore')} onClick={() => handlers.onRestoreModule(m)} />
                            </ActionGuard>
                        )}
                        {archived && (
                            <ActionGuard module={can.module} action={ACTION_CODE.DELETE}>
                                <IconButton icon={Trash2} label={t('moduleActions.delete')} tone="danger" onClick={() => handlers.onDeleteModule(m)} />
                            </ActionGuard>
                        )}
                    </td>
                </tr>
                {isOpen && children.map((c) => renderModule(c, depth + 1))}
                {isOpen && moduleActions.map((a) => renderAction(a, depth + 1))}
            </Fragment>
        );
    };

    const anyVisible = tree.roots.some((m) => moduleVisible.get(m.id));

    return (
        <div className="table-wrap" aria-busy={loading || undefined}>
            <table className="data-table tree-table">
                <thead>
                    <tr>
                        <th>{t('moduleActions.columns.code')}</th>
                        <th>{t('moduleActions.columns.name')}</th>
                        <th>{t('moduleActions.columns.path')}</th>
                        <th>{t('moduleActions.columns.elementId')}</th>
                        <th>{t('moduleActions.columns.order')}</th>
                        <th>{t('moduleActions.columns.status')}</th>
                        <th>{t('moduleActions.columns.type')}</th>
                        <th>{t('moduleActions.columns.description')}</th>
                        <th>{t('moduleActions.columns.actions')}</th>
                    </tr>
                </thead>
                <tbody>{tree.roots.map((m) => renderModule(m, 0))}</tbody>
            </table>

            {loading && (
                <div className="table-overlay">
                    <Spinner size={24} />
                </div>
            )}
            {!loading && !anyVisible && <EmptyState message={t('moduleActions.noResults')} />}
        </div>
    );
}
