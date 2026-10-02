import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Search, Eye, EyeOff } from 'lucide-react';
import i18n from '@/i18n';
import axiosClient from '@/api/axiosClient';
import ActionGuard from '@/components/ActionGuard';
import ConfirmDialog from '@/components/ConfirmDialog';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/context/ToastContext';
import { MODULE_CODE, ACTION_CODE } from '@shared/constants.json';
import { createPermissionSchema, updatePermissionSchema } from '@shared/validators/permissionValidators';
import { PERMISSION_PRESETS } from '@/constants/permissionPresets';
import { getErrorMessage } from '@/utils/errorMessage';
import { getZodErrorMessage } from '@/utils/zodErrorMessage';

const emptyForm = { id: null, permission_parent_id: null, permission_code: '', permission_name: '', description: '' };

function TriStateCheckbox({ checked, indeterminate, onChange, disabled }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate;
    }, [indeterminate]);
    return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />;
}

function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    return d.toLocaleDateString(i18n.resolvedLanguage || i18n.language);
}

export default function Permissions() {
    const { t } = useTranslation();
    const toast = useToast();
    const [roles, setRoles] = useState([]);
    const [modules, setModules] = useState([]);
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [expandedRoles, setExpandedRoles] = useState(new Set());
    const [formOpen, setFormOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('info');
    const [form, setForm] = useState(emptyForm);
    const [selected, setSelected] = useState({}); // `${moduleId}_${actionId}` -> bool
    const [expandedPerm, setExpandedPerm] = useState(new Set());
    const [confirmRole, setConfirmRole] = useState(null);
    const [grantsOpenFor, setGrantsOpenFor] = useState(new Set());
    const [expandedGrantModules, setExpandedGrantModules] = useState(new Set());
    const [presetKey, setPresetKey] = useState(PERMISSION_PRESETS[0].key);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [rolesRes, modulesRes, actionsRes] = await Promise.all([
                axiosClient.get('/permissions'),
                axiosClient.get('/modules'),
                axiosClient.get('/actions'),
            ]);
            setRoles(rolesRes.data.data);
            setModules(modulesRes.data.data);
            setActions(actionsRes.data.data);
            setExpandedRoles(new Set(rolesRes.data.data.map((r) => r.id)));
            setExpandedPerm(new Set(modulesRes.data.data.map((m) => m.id)));
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---------- Role tree helpers ----------
    const rootRoles = roles.filter((r) => !r.permission_parent_id);
    const childRolesOf = (parentId) => roles.filter((r) => r.permission_parent_id === parentId);

    const q = search.trim().toLowerCase();
    const roleMatchesSelf = (r) => {
        if (!q) return true;
        const text = `${r.permission_code} ${r.permission_name}`.toLowerCase();
        return text.includes(q);
    };
    const roleVisibleCache = useMemo(() => {
        const cache = new Map();
        const compute = (r) => {
            if (cache.has(r.id)) return cache.get(r.id);
            const visible = roleMatchesSelf(r) || childRolesOf(r.id).some(compute);
            cache.set(r.id, visible);
            return visible;
        };
        roles.forEach(compute);
        return cache;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roles, q]);

    const toggleExpandedRole = (id) => {
        setExpandedRoles((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleGrantsOpen = (roleId) => {
        setGrantsOpenFor((prev) => {
            const next = new Set(prev);
            if (next.has(roleId)) next.delete(roleId);
            else {
                next.add(roleId);
                setExpandedGrantModules(new Set(modules.map((m) => m.id)));
            }
            return next;
        });
    };

    const toggleExpandedGrantModule = (id) => {
        setExpandedGrantModules((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // ---------- Module/action grant tree helpers ----------
    const rootModules = modules.filter((m) => !m.module_parent_id);
    const childModulesOf = (parentId) => modules.filter((m) => m.module_parent_id === parentId);
    const actionsOf = (moduleId) => actions.filter((a) => a.module_id === moduleId);

    const moduleActionKeys = (m) => [
        ...actionsOf(m.id).map((a) => `${m.id}_${a.id}`),
        ...childModulesOf(m.id).flatMap(moduleActionKeys),
    ];

    const toggleCell = (moduleId, actionId) => {
        const key = `${moduleId}_${actionId}`;
        const checking = !selected[key];
        const action = actions.find((a) => a.id === actionId);
        // Tick edit/delete thì tự tick kèm view của cùng module (backend cũng tự đảm bảo
        // điều này khi lưu, đây chỉ là phản hồi tức thời trên UI).
        if (checking && (action?.action_code === ACTION_CODE.EDIT || action?.action_code === ACTION_CODE.DELETE)) {
            const viewAction = actionsOf(moduleId).find((a) => a.action_code === ACTION_CODE.VIEW);
            if (viewAction) {
                setSelected((prev) => ({ ...prev, [key]: true, [`${moduleId}_${viewAction.id}`]: true }));
                return;
            }
        }
        setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleExpandedPerm = (id) => {
        setExpandedPerm((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Áp preset thay thế toàn bộ lựa chọn hiện tại của cây quyền (không cộng dồn) — với
    // mọi action ở mọi module, check nếu action_code nằm trong preset, ngược lại bỏ check.
    const applyPreset = () => {
        const preset = PERMISSION_PRESETS.find((p) => p.key === presetKey);
        if (!preset) return;
        const next = {};
        actions.forEach((a) => {
            next[`${a.module_id}_${a.id}`] = preset.actionCodes.includes(a.action_code);
        });
        setSelected(next);
    };

    const toggleModuleAll = (m) => {
        const keys = moduleActionKeys(m);
        const checkedCount = keys.filter((k) => selected[k]).length;
        const nextChecked = checkedCount !== keys.length;
        setSelected((prev) => {
            const next = { ...prev };
            keys.forEach((k) => {
                next[k] = nextChecked;
            });
            return next;
        });
    };

    const renderPermActionRow = (a, depth) => (
        <tr key={`a-${a.id}`} className="tree-row tree-row-action">
            <td>
                <div className="tree-cell" style={{ paddingLeft: depth * 22 + 22 }}>
                    <span className="perm-code perm-code-action">{a.action_code}</span>
                </div>
            </td>
            <td>{a.action_name}</td>
            <td className="tree-muted">—</td>
            <td className="perm-check-cell">
                <input
                    type="checkbox"
                    checked={!!selected[`${a.module_id}_${a.id}`]}
                    onChange={() => toggleCell(a.module_id, a.id)}
                />
            </td>
        </tr>
    );

    const renderPermModuleRow = (m, depth) => {
        const children = childModulesOf(m.id);
        const moduleActions = actionsOf(m.id);
        const isOpen = expandedPerm.has(m.id);
        const keys = moduleActionKeys(m);
        const checkedCount = keys.filter((k) => selected[k]).length;

        return (
            <Fragment key={m.id}>
                <tr className="tree-row tree-row-module">
                    <td>
                        <div className="tree-cell" style={{ paddingLeft: depth * 22 }}>
                            <button type="button" className="tree-toggle" onClick={() => toggleExpandedPerm(m.id)}>
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <span className="perm-code perm-code-module">{m.module_code}</span>
                        </div>
                    </td>
                    <td>{m.module_name}</td>
                    <td className="tree-muted">{m.module_href || '—'}</td>
                    <td className="perm-check-cell">
                        <TriStateCheckbox
                            checked={keys.length > 0 && checkedCount === keys.length}
                            indeterminate={checkedCount > 0 && checkedCount < keys.length}
                            onChange={() => toggleModuleAll(m)}
                        />
                    </td>
                </tr>
                {isOpen && children.map((c) => renderPermModuleRow(c, depth + 1))}
                {isOpen && moduleActions.map((a) => renderPermActionRow(a, depth + 1))}
            </Fragment>
        );
    };

    // ---------- Read-only granted-permission tree (shown inline under a role row) ----------
    const renderGrantActionRow = (a, depth, grantedSet) => (
        <tr key={`ga-${a.id}`} className="tree-row tree-row-action">
            <td>
                <div className="tree-cell" style={{ paddingLeft: depth * 22 + 22 }}>
                    <span className="perm-code perm-code-action">{a.action_code}</span>
                </div>
            </td>
            <td>{a.action_name}</td>
            <td className="tree-muted">—</td>
            <td className="perm-check-cell">
                <input type="checkbox" checked={grantedSet.has(`${a.module_id}_${a.id}`)} disabled />
            </td>
        </tr>
    );

    const renderGrantModuleRow = (m, depth, grantedSet) => {
        const children = childModulesOf(m.id);
        const moduleActions = actionsOf(m.id);
        const keys = moduleActionKeys(m);
        if (keys.length === 0) return null;
        const isOpen = expandedGrantModules.has(m.id);
        const checkedCount = keys.filter((k) => grantedSet.has(k)).length;
        if (checkedCount === 0) return null;

        return (
            <Fragment key={m.id}>
                <tr className="tree-row tree-row-module">
                    <td>
                        <div className="tree-cell" style={{ paddingLeft: depth * 22 }}>
                            <button type="button" className="tree-toggle" onClick={() => toggleExpandedGrantModule(m.id)}>
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <span className="perm-code perm-code-module">{m.module_code}</span>
                        </div>
                    </td>
                    <td>{m.module_name}</td>
                    <td className="tree-muted">{m.module_href || '—'}</td>
                    <td className="perm-check-cell">
                        <TriStateCheckbox
                            checked={checkedCount === keys.length}
                            indeterminate={checkedCount > 0 && checkedCount < keys.length}
                            disabled
                        />
                    </td>
                </tr>
                {isOpen && children.map((c) => renderGrantModuleRow(c, depth + 1, grantedSet))}
                {isOpen && moduleActions.map((a) => (grantedSet.has(`${m.id}_${a.id}`) ? renderGrantActionRow(a, depth + 1, grantedSet) : null))}
            </Fragment>
        );
    };

    // ---------- Role CRUD ----------
    const openCreate = (parent = null) => {
        setForm({ ...emptyForm, permission_parent_id: parent ? parent.id : null });
        setSelected({});
        setActiveTab('info');
        setFormOpen(true);
    };

    const openEdit = (role) => {
        setForm({
            id: role.id,
            permission_parent_id: role.permission_parent_id,
            permission_code: role.permission_code,
            permission_name: role.permission_name,
            description: role.description || '',
        });
        const sel = {};
        role.details.forEach((d) => {
            sel[`${d.module_id}_${d.action_id}`] = true;
        });
        setSelected(sel);
        setActiveTab('info');
        setFormOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const details = Object.entries(selected)
            .filter(([, checked]) => checked)
            .map(([key]) => {
                const [module_id, action_id] = key.split('_').map(Number);
                return { module_id, action_id };
            });

        if (form.id) {
            const payload = { permission_name: form.permission_name, description: form.description || null, details };
            const parsed = updatePermissionSchema.safeParse(payload);
            if (!parsed.success) {
                toast.error(getZodErrorMessage(parsed, t));
                return;
            }

            setSaving(true);
            try {
                await axiosClient.put(`/permissions/${form.id}`, payload);
                toast.success('Role updated successfully');
                setFormOpen(false);
                loadAll();
            } catch (err) {
                toast.error(getErrorMessage(err, t));
            } finally {
                setSaving(false);
            }
        } else {
            const payload = {
                permission_code: form.permission_code,
                permission_name: form.permission_name,
                description: form.description || null,
                permission_parent_id: form.permission_parent_id || null,
                details,
            };
            const parsed = createPermissionSchema.safeParse(payload);
            if (!parsed.success) {
                toast.error(getZodErrorMessage(parsed, t));
                return;
            }

            setSaving(true);
            try {
                await axiosClient.post('/permissions', payload);
                toast.success('Role created successfully');
                setFormOpen(false);
                loadAll();
            } catch (err) {
                toast.error(getErrorMessage(err, t));
            } finally {
                setSaving(false);
            }
        }
    };

    const confirmDelete = async () => {
        const role = confirmRole;
        setConfirmRole(null);
        try {
            await axiosClient.delete(`/permissions/${role.id}`);
            toast.success('Role deleted');
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    const parentRole = form.permission_parent_id ? roles.find((r) => r.id === form.permission_parent_id) : null;

    const renderRoleRow = (role, depth) => {
        if (!roleVisibleCache.get(role.id)) return null;
        const children = childRolesOf(role.id);
        const isOpen = expandedRoles.has(role.id);

        return (
            <Fragment key={role.id}>
                <tr className="tree-row tree-row-module">
                    <td>
                        <div className="tree-cell" style={{ paddingLeft: depth * 22 }}>
                            {children.length > 0 ? (
                                <button type="button" className="tree-toggle" onClick={() => toggleExpandedRole(role.id)}>
                                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            ) : (
                                <span className="tree-toggle-spacer" />
                            )}
                            <span className="perm-code perm-code-module">{role.permission_code}</span>
                        </div>
                    </td>
                    <td>{role.permission_name}</td>
                    <td className="tree-muted">{role.description || '—'}</td>
                    <td>
                        <span className={`role-count-badge${role.user_count === 0 ? ' role-count-badge-zero' : ''}`}>
                            {role.user_count}
                        </span>
                    </td>
                    <td className="tree-muted">{formatDate(role.created_at)}</td>
                    <td className="actions-cell">
                        <button type="button" title={t('permissions.viewGrants')} onClick={() => toggleGrantsOpen(role.id)}>
                            {grantsOpenFor.has(role.id) ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <ActionGuard module={MODULE_CODE.PERMISSION} action={ACTION_CODE.CREATE}>
                            <button type="button" title={t('permissions.createChild')} onClick={() => openCreate(role)}>
                                <Plus size={15} />
                            </button>
                        </ActionGuard>
                        <ActionGuard module={MODULE_CODE.PERMISSION} action={ACTION_CODE.EDIT}>
                            <button type="button" title={t('users.edit')} onClick={() => openEdit(role)}>
                                <Pencil size={15} />
                            </button>
                        </ActionGuard>
                        <ActionGuard module={MODULE_CODE.PERMISSION} action={ACTION_CODE.DELETE}>
                            <button type="button" title={t('moduleActions.delete')} onClick={() => setConfirmRole(role)}>
                                <Trash2 size={15} />
                            </button>
                        </ActionGuard>
                    </td>
                </tr>
                {grantsOpenFor.has(role.id) && (
                    <tr className="tree-row">
                        <td colSpan={6} className="perm-grants-cell">
                            {role.details.length === 0 ? (
                                <div className="perm-grants-empty">{t('permissions.noGrants')}</div>
                            ) : (
                                <table className="data-table tree-table perm-grants-table">
                                    <thead>
                                        <tr>
                                            <th>{t('permissions.columns.code')}</th>
                                            <th>{t('permissions.columns.name')}</th>
                                            <th>{t('permissions.columns.path')}</th>
                                            <th>{t('permissions.columns.grant')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rootModules.map((m) =>
                                            renderGrantModuleRow(m, 0, new Set(role.details.map((d) => `${d.module_id}_${d.action_id}`)))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </td>
                    </tr>
                )}
                {isOpen && children.map((c) => renderRoleRow(c, depth + 1))}
            </Fragment>
        );
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>{t('permissions.title')}</h1>
                <ActionGuard module={MODULE_CODE.PERMISSION} action={ACTION_CODE.CREATE}>
                    <button type="button" className="btn-primary" onClick={() => openCreate(null)}>
                        <Plus size={16} /> {t('permissions.create')}
                    </button>
                </ActionGuard>
            </div>

            <div className="search-bar">
                <div className="input-with-icon search-input">
                    <Search size={16} className="input-icon-static" />
                    <input
                        type="text"
                        placeholder={t('permissions.search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="table-wrap">
                <table className="data-table tree-table">
                    <thead>
                        <tr>
                            <th>{t('permissions.roleColumns.code')}</th>
                            <th>{t('permissions.roleColumns.name')}</th>
                            <th>{t('permissions.roleColumns.description')}</th>
                            <th>{t('permissions.roleColumns.userCount')}</th>
                            <th>{t('permissions.roleColumns.createdAt')}</th>
                            <th>{t('permissions.roleColumns.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>{rootRoles.map((r) => renderRoleRow(r, 0))}</tbody>
                </table>

                {loading && (
                    <div className="table-overlay">
                        <Spinner size={24} />
                    </div>
                )}
                {!loading && roles.length === 0 && <EmptyState message="No roles found" />}
            </div>

            {formOpen && (
                <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
                    <form className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
                        <h2>{form.id ? t('permissions.updateTitle') : t('permissions.create')}</h2>

                        <div className="perm-tabs">
                            <button
                                type="button"
                                className={activeTab === 'info' ? 'active' : ''}
                                onClick={() => setActiveTab('info')}
                            >
                                1. {t('permissions.tabInfo')}
                            </button>
                            <button
                                type="button"
                                className={activeTab === 'perm' ? 'active' : ''}
                                onClick={() => setActiveTab('perm')}
                            >
                                2. {t('permissions.tabPermissions')}
                            </button>
                        </div>

                        {activeTab === 'info' && (
                            <div className="perm-tab-panel">
                                {parentRole && (
                                    <div className="perm-parent-hint">
                                        {t('permissions.parentRole')}: <strong>{parentRole.permission_name}</strong>
                                    </div>
                                )}
                                <div className="form-grid">
                                    <label>
                                        {t('permissions.roleCode')}
                                        <input
                                            type="text"
                                            value={form.permission_code}
                                            onChange={(e) => setForm({ ...form, permission_code: e.target.value })}
                                            disabled={!!form.id}
                                            required
                                        />
                                    </label>
                                    <label>
                                        {t('permissions.roleName')}
                                        <input
                                            type="text"
                                            value={form.permission_name}
                                            onChange={(e) => setForm({ ...form, permission_name: e.target.value })}
                                            required
                                        />
                                    </label>
                                    <label className="form-span-2">
                                        {t('permissions.roleDescription')}
                                        <input
                                            type="text"
                                            value={form.description}
                                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'perm' && (
                            <div className="perm-tab-panel">
                                <div className="preset-bar">
                                    <select value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
                                        {PERMISSION_PRESETS.map((p) => (
                                            <option key={p.key} value={p.key}>
                                                {t(`permissions.presets.${p.key}`)}
                                            </option>
                                        ))}
                                    </select>
                                    <button type="button" onClick={applyPreset}>
                                        {t('permissions.applyPreset')}
                                    </button>
                                </div>
                                <div className="table-wrap perm-tree-wrap">
                                    <table className="data-table tree-table">
                                        <thead>
                                            <tr>
                                                <th>{t('permissions.columns.code')}</th>
                                                <th>{t('permissions.columns.name')}</th>
                                                <th>{t('permissions.columns.path')}</th>
                                                <th>{t('permissions.columns.grant')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>{rootModules.map((m) => renderPermModuleRow(m, 0))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="modal-actions">
                            <button type="button" onClick={() => setFormOpen(false)} disabled={saving}>
                                {t('users.form.cancel')}
                            </button>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving && <Spinner size={14} />}
                                {t('users.form.save')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <ConfirmDialog
                open={!!confirmRole}
                title="Delete role"
                message={`Delete role "${confirmRole?.permission_name}"? This will also remove its sub-roles and unassign it from all users.`}
                confirmLabel="Delete"
                cancelLabel={t('users.form.cancel')}
                tone="danger"
                onConfirm={confirmDelete}
                onCancel={() => setConfirmRole(null)}
            />
        </div>
    );
}
