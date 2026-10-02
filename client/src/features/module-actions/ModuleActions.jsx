import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronRight,
    ChevronDown,
    Package,
    FolderTree,
    Zap,
    Plus,
    Pencil,
    Lock,
    Unlock,
    Trash2,
    Search,
    ListChecks,
    Copy,
    Archive,
    RotateCcw,
    Users,
    AlertTriangle,
} from 'lucide-react';
import axiosClient from '@/core/api/axiosClient';
import ActionGuard from '@/core/permissions/ActionGuard';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/app/providers/ToastContext';
import { MODULE_CODE, ACTION_CODE, RECORD_STATUS, MODULE_TYPE } from '@shared/constants.json';
import { MODULE_ICON_MAP, MODULE_ICON_OPTIONS } from '@/constants/moduleIcons';
import { createModuleSchema, updateModuleSchema, cloneModuleSchema } from '@shared/validators/moduleValidators';
import { createActionSchema, updateActionSchema } from '@shared/validators/actionValidators';
import { getErrorMessage } from '@/core/errors/errorMessage';
import { getZodErrorMessage } from '@/core/errors/zodErrorMessage';

const emptyModuleForm = {
    id: null,
    module_parent_id: null,
    module_code: '',
    module_name: '',
    module_type: MODULE_TYPE.MENU,
    module_icon: '',
    module_href: '',
    module_element_id: '',
    module_index: 0,
    description: '',
};

const emptyActionForm = {
    id: null,
    module_id: null,
    action_code: '',
    action_name: '',
    rate_limit_per_minute: '',
    description: '',
};

export default function ModuleActions() {
    const { t } = useTranslation();
    const toast = useToast();

    const [modules, setModules] = useState([]);
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [expanded, setExpanded] = useState(new Set());

    const [moduleForm, setModuleForm] = useState(null); // null = closed, object = open
    const [actionForm, setActionForm] = useState(null);
    const [cloneForm, setCloneForm] = useState(null);
    const [confirmDeleteModule, setConfirmDeleteModule] = useState(null);
    const [confirmDeleteAction, setConfirmDeleteAction] = useState(null);
    const [insights, setInsights] = useState({ unusedActions: [], emptyModules: [], unusedRoles: [], actionRoleMap: {} });
    const [insightsOpen, setInsightsOpen] = useState(false);
    const [roleLookupOpenFor, setRoleLookupOpenFor] = useState(new Set());

    const loadAll = async () => {
        setLoading(true);
        try {
            const [modulesRes, actionsRes, insightsRes] = await Promise.all([
                axiosClient.get('/modules'),
                axiosClient.get('/actions'),
                axiosClient.get('/insights/module-actions'),
            ]);
            setModules(modulesRes.data.data);
            setActions(actionsRes.data.data);
            setExpanded(new Set(modulesRes.data.data.map((m) => m.id)));
            setInsights(insightsRes.data.data);
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setLoading(false);
        }
    };

    const toggleRoleLookup = (actionId) => {
        setRoleLookupOpenFor((prev) => {
            const next = new Set(prev);
            if (next.has(actionId)) next.delete(actionId);
            else next.add(actionId);
            return next;
        });
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleExpanded = (id) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const q = search.trim().toLowerCase();
    const statusOk = (status) => statusFilter === '' || String(status) === statusFilter;

    const actionMatches = (a) => {
        const text = `${a.action_code} ${a.action_name}`.toLowerCase();
        return statusOk(a.status) && (!q || text.includes(q));
    };

    const moduleTextMatches = (m) => {
        const text = `${m.module_code} ${m.module_name}`.toLowerCase();
        return !q || text.includes(q);
    };

    const childModulesOf = (parentId) => modules.filter((m) => m.module_parent_id === parentId);
    const actionsOf = (moduleId) => actions.filter((a) => a.module_id === moduleId);

    const moduleVisibleCache = useMemo(() => {
        const cache = new Map();
        const compute = (m) => {
            if (cache.has(m.id)) return cache.get(m.id);
            const ownActionVisible = actionsOf(m.id).some(actionMatches);
            const childVisible = childModulesOf(m.id).some(compute);
            const selfVisible = statusOk(m.status) && moduleTextMatches(m);
            const visible = selfVisible || ownActionVisible || childVisible;
            cache.set(m.id, visible);
            return visible;
        };
        modules.forEach(compute);
        return cache;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modules, actions, q, statusFilter]);

    const isFiltering = q !== '' || statusFilter !== '';

    const openCreateRootModule = () => {
        setModuleForm({ ...emptyModuleForm, module_parent_id: null });
    };

    const openCreateChildModule = (parent) => {
        setModuleForm({ ...emptyModuleForm, module_parent_id: parent.id });
    };

    const openEditModule = (m) => {
        setModuleForm({
            id: m.id,
            module_parent_id: m.module_parent_id,
            module_code: m.module_code,
            module_name: m.module_name,
            module_type: m.module_type || MODULE_TYPE.MENU,
            module_icon: m.module_icon || '',
            module_href: m.module_href || '',
            module_element_id: m.module_element_id || '',
            module_index: m.module_index ?? 0,
            description: m.description || '',
        });
    };

    const openCreateAction = (m) => {
        setActionForm({ ...emptyActionForm, module_id: m.id });
    };

    const openCloneModule = (m) => {
        setCloneForm({ id: m.id, module_code: `${m.module_code}_COPY`, module_name: `${m.module_name} (Copy)` });
    };

    const handleCloneModule = async (e) => {
        e.preventDefault();
        const payload = { module_code: cloneForm.module_code, module_name: cloneForm.module_name };
        const parsed = cloneModuleSchema.safeParse(payload);
        if (!parsed.success) {
            toast.error(getZodErrorMessage(parsed, t));
            return;
        }

        setSaving(true);
        try {
            await axiosClient.post(`/modules/${cloneForm.id}/clone`, payload);
            toast.success(t('moduleActions.cloneSuccess'));
            setCloneForm(null);
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setSaving(false);
        }
    };

    const handleScaffoldActions = async (m) => {
        try {
            const { data } = await axiosClient.post(`/actions/scaffold/${m.id}`);
            if (data.data.created.length > 0) {
                toast.success(`${t('moduleActions.scaffoldSuccess')}: ${data.data.created.join(', ')}`);
            } else {
                toast.info(t('moduleActions.scaffoldNoop'));
            }
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    const openEditAction = (a) => {
        setActionForm({
            id: a.id,
            module_id: a.module_id,
            action_code: a.action_code,
            action_name: a.action_name,
            rate_limit_per_minute: a.rate_limit_per_minute ?? '',
            description: a.description || '',
        });
    };

    const handleSaveModule = async (e) => {
        e.preventDefault();

        if (moduleForm.id) {
            const payload = {
                module_name: moduleForm.module_name,
                module_type: Number(moduleForm.module_type) || MODULE_TYPE.MENU,
                module_icon: moduleForm.module_icon || null,
                module_href: moduleForm.module_href || null,
                module_element_id: moduleForm.module_element_id || null,
                module_index: Number(moduleForm.module_index) || 0,
                description: moduleForm.description || null,
            };
            const parsed = updateModuleSchema.safeParse(payload);
            if (!parsed.success) {
                toast.error(getZodErrorMessage(parsed, t));
                return;
            }

            setSaving(true);
            try {
                await axiosClient.put(`/modules/${moduleForm.id}`, payload);
                toast.success(t('moduleActions.form.editModuleTitle'));
                setModuleForm(null);
                loadAll();
            } catch (err) {
                toast.error(getErrorMessage(err, t));
            } finally {
                setSaving(false);
            }
        } else {
            const payload = {
                module_code: moduleForm.module_code,
                module_name: moduleForm.module_name,
                module_type: Number(moduleForm.module_type) || MODULE_TYPE.MENU,
                module_icon: moduleForm.module_icon || null,
                module_href: moduleForm.module_href || null,
                module_element_id: moduleForm.module_element_id || null,
                module_parent_id: moduleForm.module_parent_id || null,
                module_index: Number(moduleForm.module_index) || 0,
                description: moduleForm.description || null,
            };
            const parsed = createModuleSchema.safeParse(payload);
            if (!parsed.success) {
                toast.error(getZodErrorMessage(parsed, t));
                return;
            }

            setSaving(true);
            try {
                await axiosClient.post('/modules', payload);
                toast.success(t('moduleActions.form.createModuleTitle'));
                setModuleForm(null);
                loadAll();
            } catch (err) {
                toast.error(getErrorMessage(err, t));
            } finally {
                setSaving(false);
            }
        }
    };

    const handleSaveAction = async (e) => {
        e.preventDefault();
        const rateLimit = actionForm.rate_limit_per_minute === '' ? null : Number(actionForm.rate_limit_per_minute);

        if (actionForm.id) {
            const payload = {
                action_name: actionForm.action_name,
                description: actionForm.description || null,
                rate_limit_per_minute: rateLimit,
            };
            const parsed = updateActionSchema.safeParse(payload);
            if (!parsed.success) {
                toast.error(getZodErrorMessage(parsed, t));
                return;
            }

            setSaving(true);
            try {
                await axiosClient.put(`/actions/${actionForm.id}`, payload);
                toast.success(t('moduleActions.form.editActionTitle'));
                setActionForm(null);
                loadAll();
            } catch (err) {
                toast.error(getErrorMessage(err, t));
            } finally {
                setSaving(false);
            }
        } else {
            const payload = {
                module_id: actionForm.module_id,
                action_code: actionForm.action_code,
                action_name: actionForm.action_name,
                description: actionForm.description || null,
                rate_limit_per_minute: rateLimit,
            };
            const parsed = createActionSchema.safeParse(payload);
            if (!parsed.success) {
                toast.error(getZodErrorMessage(parsed, t));
                return;
            }

            setSaving(true);
            try {
                await axiosClient.post('/actions', payload);
                toast.success(t('moduleActions.form.createActionTitle'));
                setActionForm(null);
                loadAll();
            } catch (err) {
                toast.error(getErrorMessage(err, t));
            } finally {
                setSaving(false);
            }
        }
    };

    const handleArchiveModule = async (m) => {
        try {
            await axiosClient.post(`/modules/${m.id}/archive`);
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    const handleRestoreModule = async (m) => {
        try {
            await axiosClient.post(`/modules/${m.id}/restore`);
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    const handleArchiveAction = async (a) => {
        try {
            await axiosClient.post(`/actions/${a.id}/archive`);
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    const handleRestoreAction = async (a) => {
        try {
            await axiosClient.post(`/actions/${a.id}/restore`);
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    const toggleModuleStatus = async (m) => {
        try {
            await axiosClient.put(`/modules/${m.id}`, {
                module_name: m.module_name,
                status: m.status === RECORD_STATUS.ACTIVE ? RECORD_STATUS.INACTIVE : RECORD_STATUS.ACTIVE,
            });
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    const toggleActionStatus = async (a) => {
        try {
            await axiosClient.put(`/actions/${a.id}`, {
                action_name: a.action_name,
                status: a.status === RECORD_STATUS.ACTIVE ? RECORD_STATUS.INACTIVE : RECORD_STATUS.ACTIVE,
            });
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    const confirmDeleteModuleNow = async () => {
        const m = confirmDeleteModule;
        setConfirmDeleteModule(null);
        try {
            await axiosClient.delete(`/modules/${m.id}`);
            toast.success(t('moduleActions.delete'));
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    const confirmDeleteActionNow = async () => {
        const a = confirmDeleteAction;
        setConfirmDeleteAction(null);
        try {
            await axiosClient.delete(`/actions/${a.id}`);
            toast.success(t('moduleActions.delete'));
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    const renderActionRow = (a, depth) => {
        if (isFiltering && !actionMatches(a)) return null;
        const archived = a.status === RECORD_STATUS.ARCHIVED;
        const rolesForAction = insights.actionRoleMap[a.id] || [];
        const lookupOpen = roleLookupOpenFor.has(a.id);
        return (
            <Fragment key={`action-${a.id}`}>
                <tr className="tree-row tree-row-action">
                    <td>
                        <div className="tree-cell" style={{ paddingLeft: depth * 22 + 22 }}>
                            <Zap size={14} className="tree-icon-action" />
                            <span className="tree-code">{a.action_code}</span>
                        </div>
                    </td>
                    <td>{a.action_name}</td>
                    <td className="tree-muted">—</td>
                    <td className="tree-muted">—</td>
                    <td className="tree-muted">—</td>
                    <td>
                        <span
                            className={`badge ${
                                archived ? 'badge-archived' : a.status === RECORD_STATUS.ACTIVE ? 'badge-active' : 'badge-locked'
                            }`}
                        >
                            {archived
                                ? t('moduleActions.status.archived')
                                : a.status === RECORD_STATUS.ACTIVE
                                  ? t('moduleActions.status.active')
                                  : t('moduleActions.status.inactive')}
                        </span>
                    </td>
                    <td>
                        <span className="type-badge type-badge-action">{t('moduleActions.type.action')}</span>
                        {a.rate_limit_per_minute && (
                            <span className="type-badge type-badge-ratelimit">{a.rate_limit_per_minute}/{t('moduleActions.perMinute')}</span>
                        )}
                    </td>
                    <td className="tree-muted">{a.description || '—'}</td>
                    <td className="actions-cell">
                        <button type="button" title={t('moduleActions.viewRoles')} onClick={() => toggleRoleLookup(a.id)}>
                            <Users size={15} />
                        </button>
                        {!archived && (
                            <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.EDIT}>
                                <button type="button" title={t('moduleActions.edit')} onClick={() => openEditAction(a)}>
                                    <Pencil size={15} />
                                </button>
                                <button
                                    type="button"
                                    title={a.status === RECORD_STATUS.ACTIVE ? t('moduleActions.lock') : t('moduleActions.unlock')}
                                    onClick={() => toggleActionStatus(a)}
                                >
                                    {a.status === RECORD_STATUS.ACTIVE ? <Lock size={15} /> : <Unlock size={15} />}
                                </button>
                                <button type="button" title={t('moduleActions.archive')} onClick={() => handleArchiveAction(a)}>
                                    <Archive size={15} />
                                </button>
                            </ActionGuard>
                        )}
                        {archived && (
                            <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.EDIT}>
                                <button type="button" title={t('moduleActions.restore')} onClick={() => handleRestoreAction(a)}>
                                    <RotateCcw size={15} />
                                </button>
                            </ActionGuard>
                        )}
                        {archived && (
                            <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.DELETE}>
                                <button type="button" title={t('moduleActions.delete')} onClick={() => setConfirmDeleteAction(a)}>
                                    <Trash2 size={15} />
                                </button>
                            </ActionGuard>
                        )}
                    </td>
                </tr>
                {lookupOpen && (
                    <tr className="tree-row">
                        <td colSpan={9} className="role-lookup-cell">
                            {rolesForAction.length === 0
                                ? t('moduleActions.noRolesGranted')
                                : rolesForAction.map((r) => (
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

    const renderModuleRow = (m, depth) => {
        if (!moduleVisibleCache.get(m.id)) return null;

        const children = childModulesOf(m.id);
        const moduleActions = actionsOf(m.id);
        const isOpen = expanded.has(m.id);
        const hasContent = children.length > 0 || moduleActions.length > 0;
        const archived = m.status === RECORD_STATUS.ARCHIVED;

        return (
            <Fragment key={m.id}>
                <tr className="tree-row tree-row-module">
                    <td>
                        <div className="tree-cell" style={{ paddingLeft: depth * 22 }}>
                            {hasContent ? (
                                <button type="button" className="tree-toggle" onClick={() => toggleExpanded(m.id)}>
                                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            ) : (
                                <span className="tree-toggle-spacer" />
                            )}
                            {(() => {
                                const CustomIcon = MODULE_ICON_MAP[m.module_icon];
                                if (CustomIcon) return <CustomIcon size={15} className="tree-icon-module" />;
                                return depth === 0 ? (
                                    <Package size={15} className="tree-icon-module" />
                                ) : (
                                    <FolderTree size={15} className="tree-icon-module" />
                                );
                            })()}
                            <span className="tree-code">{m.module_code}</span>
                        </div>
                    </td>
                    <td>{m.module_name}</td>
                    <td className="tree-muted">{m.module_href || '—'}</td>
                    <td className="tree-muted">{m.module_element_id || '—'}</td>
                    <td className="tree-muted">{m.module_index ?? 0}</td>
                    <td>
                        <span
                            className={`badge ${
                                archived ? 'badge-archived' : m.status === RECORD_STATUS.ACTIVE ? 'badge-active' : 'badge-locked'
                            }`}
                        >
                            {archived
                                ? t('moduleActions.status.archived')
                                : m.status === RECORD_STATUS.ACTIVE
                                  ? t('moduleActions.status.active')
                                  : t('moduleActions.status.inactive')}
                        </span>
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
                                <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.CREATE}>
                                    <button type="button" title={t('moduleActions.createChildModule')} onClick={() => openCreateChildModule(m)}>
                                        <Plus size={15} />
                                    </button>
                                </ActionGuard>
                                <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.EDIT}>
                                    <button type="button" title={t('moduleActions.edit')} onClick={() => openEditModule(m)}>
                                        <Pencil size={15} />
                                    </button>
                                </ActionGuard>
                                <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.CREATE}>
                                    <button type="button" title={t('moduleActions.createAction')} onClick={() => openCreateAction(m)}>
                                        <Zap size={15} />
                                    </button>
                                </ActionGuard>
                                <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.CREATE}>
                                    <button type="button" title={t('moduleActions.scaffoldActions')} onClick={() => handleScaffoldActions(m)}>
                                        <ListChecks size={15} />
                                    </button>
                                </ActionGuard>
                                <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.CREATE}>
                                    <button type="button" title={t('moduleActions.cloneModule')} onClick={() => openCloneModule(m)}>
                                        <Copy size={15} />
                                    </button>
                                </ActionGuard>
                                <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.EDIT}>
                                    <button
                                        type="button"
                                        title={m.status === RECORD_STATUS.ACTIVE ? t('moduleActions.lock') : t('moduleActions.unlock')}
                                        onClick={() => toggleModuleStatus(m)}
                                    >
                                        {m.status === RECORD_STATUS.ACTIVE ? <Lock size={15} /> : <Unlock size={15} />}
                                    </button>
                                </ActionGuard>
                                <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.EDIT}>
                                    <button type="button" title={t('moduleActions.archive')} onClick={() => handleArchiveModule(m)}>
                                        <Archive size={15} />
                                    </button>
                                </ActionGuard>
                            </>
                        )}
                        {archived && (
                            <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.EDIT}>
                                <button type="button" title={t('moduleActions.restore')} onClick={() => handleRestoreModule(m)}>
                                    <RotateCcw size={15} />
                                </button>
                            </ActionGuard>
                        )}
                        {archived && (
                            <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.DELETE}>
                                <button type="button" title={t('moduleActions.delete')} onClick={() => setConfirmDeleteModule(m)}>
                                    <Trash2 size={15} />
                                </button>
                            </ActionGuard>
                        )}
                    </td>
                </tr>
                {(isOpen || isFiltering) && children.map((c) => renderModuleRow(c, depth + 1))}
                {(isOpen || isFiltering) && moduleActions.map((a) => renderActionRow(a, depth + 1))}
            </Fragment>
        );
    };

    const rootModules = modules.filter((m) => !m.module_parent_id);
    const anyVisible = rootModules.some((m) => moduleVisibleCache.get(m.id));

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1>{t('moduleActions.title')}</h1>
                    <p className="page-subtitle">{t('moduleActions.subtitle')}</p>
                </div>
                <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.CREATE}>
                    <button type="button" className="btn-primary" onClick={openCreateRootModule}>
                        <Plus size={16} /> {t('moduleActions.createRootModule')}
                    </button>
                </ActionGuard>
            </div>

            {(insights.unusedActions.length > 0 || insights.emptyModules.length > 0 || insights.unusedRoles.length > 0) && (
                <div className="insights-panel">
                    <button type="button" className="insights-toggle" onClick={() => setInsightsOpen((v) => !v)}>
                        <AlertTriangle size={15} />
                        {t('moduleActions.insightsTitle')} (
                        {insights.unusedActions.length + insights.emptyModules.length + insights.unusedRoles.length})
                        {insightsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {insightsOpen && (
                        <div className="insights-body">
                            {insights.unusedActions.length > 0 && (
                                <div>
                                    <strong>{t('moduleActions.insightsUnusedActions')}</strong>:{' '}
                                    {insights.unusedActions.map((a) => `${a.module_code}:${a.action_code}`).join(', ')}
                                </div>
                            )}
                            {insights.emptyModules.length > 0 && (
                                <div>
                                    <strong>{t('moduleActions.insightsEmptyModules')}</strong>:{' '}
                                    {insights.emptyModules.map((m) => m.module_code).join(', ')}
                                </div>
                            )}
                            {insights.unusedRoles.length > 0 && (
                                <div>
                                    <strong>{t('moduleActions.insightsUnusedRoles')}</strong>:{' '}
                                    {insights.unusedRoles.map((r) => r.permission_code).join(', ')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="search-bar">
                <div className="input-with-icon search-input">
                    <Search size={16} className="input-icon-static" />
                    <input
                        type="text"
                        placeholder={t('moduleActions.search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">{t('moduleActions.allStatuses')}</option>
                    <option value={String(RECORD_STATUS.ACTIVE)}>{t('moduleActions.status.active')}</option>
                    <option value={String(RECORD_STATUS.INACTIVE)}>{t('moduleActions.status.inactive')}</option>
                    <option value={String(RECORD_STATUS.ARCHIVED)}>{t('moduleActions.status.archived')}</option>
                </select>
            </div>

            <div className="table-wrap">
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
                    <tbody>{rootModules.map((m) => renderModuleRow(m, 0))}</tbody>
                </table>

                {loading && (
                    <div className="table-overlay">
                        <Spinner size={24} />
                    </div>
                )}
                {!loading && !anyVisible && <EmptyState message={t('moduleActions.noResults')} />}
            </div>

            {moduleForm && (
                <div className="modal-backdrop" onClick={() => setModuleForm(null)}>
                    <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveModule}>
                        <h2>
                            {moduleForm.id
                                ? t('moduleActions.form.editModuleTitle')
                                : t('moduleActions.form.createModuleTitle')}
                        </h2>

                        <div className="form-grid">
                            {!moduleForm.id && (
                                <label>
                                    {t('moduleActions.form.moduleCode')}
                                    <input
                                        type="text"
                                        value={moduleForm.module_code}
                                        onChange={(e) => setModuleForm({ ...moduleForm, module_code: e.target.value.toUpperCase() })}
                                        required
                                    />
                                </label>
                            )}

                            <label className={moduleForm.id ? 'form-span-2' : ''}>
                                {t('moduleActions.form.moduleName')}
                                <input
                                    type="text"
                                    value={moduleForm.module_name}
                                    onChange={(e) => setModuleForm({ ...moduleForm, module_name: e.target.value })}
                                    required
                                />
                            </label>

                            <label className="form-span-2">
                                {t('moduleActions.form.moduleHref')}
                                <input
                                    type="text"
                                    value={moduleForm.module_href}
                                    onChange={(e) => setModuleForm({ ...moduleForm, module_href: e.target.value })}
                                    placeholder="/example"
                                />
                            </label>

                            <label className="form-span-2">
                                {t('moduleActions.form.moduleType')}
                                <select
                                    value={moduleForm.module_type}
                                    onChange={(e) => setModuleForm({ ...moduleForm, module_type: Number(e.target.value) })}
                                >
                                    <option value={MODULE_TYPE.MENU}>{t('moduleActions.form.moduleTypeMenu')}</option>
                                    <option value={MODULE_TYPE.SCREEN}>{t('moduleActions.form.moduleTypeScreen')}</option>
                                </select>
                            </label>

                            <label className="form-span-2">
                                {t('moduleActions.form.moduleIcon')}
                                <div className="icon-picker">
                                    {MODULE_ICON_OPTIONS.map((name) => {
                                        const IconComp = MODULE_ICON_MAP[name];
                                        const active = moduleForm.module_icon === name;
                                        return (
                                            <button
                                                key={name}
                                                type="button"
                                                title={name}
                                                className={`icon-picker-btn${active ? ' icon-picker-btn-active' : ''}`}
                                                onClick={() => setModuleForm({ ...moduleForm, module_icon: active ? '' : name })}
                                            >
                                                <IconComp size={16} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </label>

                            <label>
                                {t('moduleActions.form.moduleElementId')}
                                <input
                                    type="text"
                                    value={moduleForm.module_element_id}
                                    onChange={(e) => setModuleForm({ ...moduleForm, module_element_id: e.target.value })}
                                />
                            </label>

                            <label>
                                {t('moduleActions.form.moduleIndex')}
                                <input
                                    type="number"
                                    value={moduleForm.module_index}
                                    onChange={(e) => setModuleForm({ ...moduleForm, module_index: e.target.value })}
                                />
                            </label>

                            <label className="form-span-2">
                                {t('moduleActions.form.description')}
                                <input
                                    type="text"
                                    value={moduleForm.description}
                                    onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                                />
                            </label>
                        </div>

                        <div className="modal-actions">
                            <button type="button" onClick={() => setModuleForm(null)} disabled={saving}>
                                {t('moduleActions.form.cancel')}
                            </button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving && <Spinner size={14} />}
                                {t('moduleActions.form.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {actionForm && (
                <div className="modal-backdrop" onClick={() => setActionForm(null)}>
                    <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveAction}>
                        <h2>
                            {actionForm.id
                                ? t('moduleActions.form.editActionTitle')
                                : t('moduleActions.form.createActionTitle')}
                        </h2>

                        <div className="form-grid">
                            {!actionForm.id && (
                                <label>
                                    {t('moduleActions.form.actionCode')}
                                    <input
                                        type="text"
                                        value={actionForm.action_code}
                                        onChange={(e) => setActionForm({ ...actionForm, action_code: e.target.value.toLowerCase() })}
                                        required
                                    />
                                </label>
                            )}

                            <label className={actionForm.id ? 'form-span-2' : ''}>
                                {t('moduleActions.form.actionName')}
                                <input
                                    type="text"
                                    value={actionForm.action_name}
                                    onChange={(e) => setActionForm({ ...actionForm, action_name: e.target.value })}
                                    required
                                />
                            </label>

                            <label>
                                {t('moduleActions.form.rateLimit')}
                                <input
                                    type="number"
                                    min="1"
                                    placeholder={t('moduleActions.form.rateLimitPlaceholder')}
                                    value={actionForm.rate_limit_per_minute}
                                    onChange={(e) => setActionForm({ ...actionForm, rate_limit_per_minute: e.target.value })}
                                />
                            </label>

                            <label className="form-span-2">
                                {t('moduleActions.form.description')}
                                <input
                                    type="text"
                                    value={actionForm.description}
                                    onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                                />
                            </label>
                        </div>

                        <div className="modal-actions">
                            <button type="button" onClick={() => setActionForm(null)} disabled={saving}>
                                {t('moduleActions.form.cancel')}
                            </button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving && <Spinner size={14} />}
                                {t('moduleActions.form.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {cloneForm && (
                <div className="modal-backdrop" onClick={() => setCloneForm(null)}>
                    <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleCloneModule}>
                        <h2>{t('moduleActions.cloneModule')}</h2>

                        <div className="form-grid">
                            <label>
                                {t('moduleActions.form.moduleCode')}
                                <input
                                    type="text"
                                    value={cloneForm.module_code}
                                    onChange={(e) => setCloneForm({ ...cloneForm, module_code: e.target.value.toUpperCase() })}
                                    required
                                />
                            </label>

                            <label>
                                {t('moduleActions.form.moduleName')}
                                <input
                                    type="text"
                                    value={cloneForm.module_name}
                                    onChange={(e) => setCloneForm({ ...cloneForm, module_name: e.target.value })}
                                    required
                                />
                            </label>
                        </div>

                        <div className="modal-actions">
                            <button type="button" onClick={() => setCloneForm(null)} disabled={saving}>
                                {t('moduleActions.form.cancel')}
                            </button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving && <Spinner size={14} />}
                                {t('moduleActions.form.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <ConfirmDialog
                open={!!confirmDeleteModule}
                title={t('moduleActions.delete')}
                message={t('moduleActions.confirmDeleteModule')}
                confirmLabel={t('moduleActions.delete')}
                cancelLabel={t('moduleActions.form.cancel')}
                tone="danger"
                onConfirm={confirmDeleteModuleNow}
                onCancel={() => setConfirmDeleteModule(null)}
            />

            <ConfirmDialog
                open={!!confirmDeleteAction}
                title={t('moduleActions.delete')}
                message={t('moduleActions.confirmDeleteAction')}
                confirmLabel={t('moduleActions.delete')}
                cancelLabel={t('moduleActions.form.cancel')}
                tone="danger"
                onConfirm={confirmDeleteActionNow}
                onCancel={() => setConfirmDeleteAction(null)}
            />
        </div>
    );
}
