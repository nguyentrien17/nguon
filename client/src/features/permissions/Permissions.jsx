import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, Search, Eye, EyeOff } from 'lucide-react';
import ActionGuard from '@/core/permissions/ActionGuard';
import { Button, ConfirmDialog, EmptyState, IconButton, Spinner } from '@/components/ui';
import { useToast } from '@/app/providers/ToastContext';
import { MODULE_CODE, ACTION_CODE } from '@shared/constants.json';
import { getErrorMessage } from '@/core/errors/errorMessage';
import RoleFormModal from './RoleFormModal';
import RoleGrantsTable from './RoleGrantsTable';
import { createRoleTree, roleVisibility } from './permissionTree';
import { deleteRole, listActions, listModules, listRoles } from './permissionApi';

// Trang cây vai trò: tìm kiếm, mở rộng/thu gọn, xem quyền đã cấp, tạo/sửa/xoá.
// Form ở RoleFormModal, cây cấp quyền ở PermissionTreeEditor, API ở permissionApi.
export default function Permissions() {
    const { t, i18n } = useTranslation();
    const toast = useToast();
    const [roles, setRoles] = useState([]);
    const [modules, setModules] = useState([]);
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState(new Set());
    const [grantsOpenFor, setGrantsOpenFor] = useState(new Set());
    // null = đóng; { role: null|Role, parent: null|Role }
    const [roleForm, setRoleForm] = useState(null);
    const [confirmRole, setConfirmRole] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [rolesRes, modulesRes, actionsRes] = await Promise.all([listRoles(), listModules(), listActions()]);
            setRoles(rolesRes.data);
            setModules(modulesRes.data);
            setActions(actionsRes.data);
            setExpanded(new Set(rolesRes.data.map((r) => r.id)));
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

    const tree = useMemo(() => createRoleTree(roles), [roles]);
    const visible = useMemo(() => roleVisibility(roles, tree, search), [roles, tree, search]);

    const toggleIn = (setter, id) =>
        setter((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const confirmDelete = async () => {
        setDeleting(true);
        try {
            await deleteRole(confirmRole.id);
            toast.success(t('permissions.deleted'));
            loadAll();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setDeleting(false);
            setConfirmRole(null);
        }
    };

    const formatDate = (value) => (value ? new Date(value).toLocaleDateString(i18n.resolvedLanguage || i18n.language) : '—');

    const renderRoleRow = (role, depth) => {
        if (!visible.get(role.id)) return null;
        const children = tree.childrenOf(role.id);
        const isOpen = expanded.has(role.id);
        const grantsOpen = grantsOpenFor.has(role.id);

        return (
            <Fragment key={role.id}>
                <tr className="tree-row tree-row-module">
                    <td>
                        <div className="tree-cell" style={{ paddingLeft: depth * 22 }}>
                            {children.length > 0 ? (
                                <button type="button" className="tree-toggle" onClick={() => toggleIn(setExpanded, role.id)} aria-expanded={isOpen}>
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
                        <span className={`role-count-badge${role.user_count === 0 ? ' role-count-badge-zero' : ''}`}>{role.user_count}</span>
                    </td>
                    <td className="tree-muted">{formatDate(role.created_at)}</td>
                    <td className="actions-cell">
                        <IconButton icon={grantsOpen ? EyeOff : Eye} label={t('permissions.viewGrants')} onClick={() => toggleIn(setGrantsOpenFor, role.id)} />
                        <ActionGuard module={MODULE_CODE.PERMISSION} action={ACTION_CODE.CREATE}>
                            <IconButton icon={Plus} label={t('permissions.createChild')} onClick={() => setRoleForm({ role: null, parent: role })} />
                        </ActionGuard>
                        <ActionGuard module={MODULE_CODE.PERMISSION} action={ACTION_CODE.EDIT}>
                            <IconButton icon={Pencil} label={t('users.edit')} onClick={() => setRoleForm({ role, parent: roles.find((r) => r.id === role.permission_parent_id) ?? null })} />
                        </ActionGuard>
                        <ActionGuard module={MODULE_CODE.PERMISSION} action={ACTION_CODE.DELETE}>
                            <IconButton icon={Trash2} label={t('moduleActions.delete')} tone="danger" onClick={() => setConfirmRole(role)} />
                        </ActionGuard>
                    </td>
                </tr>
                {grantsOpen && (
                    <tr className="tree-row">
                        <td colSpan={6} className="perm-grants-cell">
                            <RoleGrantsTable role={role} modules={modules} actions={actions} />
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
                    <Button variant="primary" icon={Plus} onClick={() => setRoleForm({ role: null, parent: null })}>
                        {t('permissions.create')}
                    </Button>
                </ActionGuard>
            </div>

            {/* Lọc tức thì trên dữ liệu đã tải (không gọi API) nên không dùng SearchBar có nút Tìm. */}
            <div className="search-bar">
                <div className="input-with-icon search-input">
                    <Search size={16} className="input-icon-static" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder={t('permissions.search')}
                        aria-label={t('permissions.search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="table-wrap" aria-busy={loading || undefined}>
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
                    <tbody>{tree.roots.map((r) => renderRoleRow(r, 0))}</tbody>
                </table>

                {loading && (
                    <div className="table-overlay">
                        <Spinner size={24} />
                    </div>
                )}
                {!loading && roles.length === 0 && <EmptyState message={t('permissions.empty')} />}
            </div>

            {roleForm && (
                <RoleFormModal
                    role={roleForm.role}
                    parent={roleForm.parent}
                    modules={modules}
                    actions={actions}
                    onClose={() => setRoleForm(null)}
                    onSaved={loadAll}
                />
            )}

            <ConfirmDialog
                open={!!confirmRole}
                title={t('permissions.deleteTitle')}
                message={t('permissions.deleteConfirm', { name: confirmRole?.permission_name })}
                confirmLabel={t('moduleActions.delete')}
                cancelLabel={t('users.form.cancel')}
                tone="danger"
                loading={deleting}
                onConfirm={confirmDelete}
                onCancel={() => setConfirmRole(null)}
            />
        </div>
    );
}
