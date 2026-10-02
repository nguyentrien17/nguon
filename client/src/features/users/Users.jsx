import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock, Pencil, Plus, Search, ShieldCheck, Download } from 'lucide-react';
import axiosClient from '@/core/api/axiosClient';
import ActionGuard from '@/core/permissions/ActionGuard';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import UserRolesModal from './UserRolesModal';
import { useToast } from '@/app/providers/ToastContext';
import { useAuth } from '@/core/auth/AuthContext';
import { MODULE_CODE, ACTION_CODE, USER_STATUS } from '@shared/constants.json';
import { createUserSchema, updateUserSchema } from '@shared/validators/userValidators';
import { getErrorMessage } from '@/core/errors/errorMessage';
import { getZodErrorMessage } from '@/core/errors/zodErrorMessage';

const emptyForm = { id: null, username: '', email: '', full_name: '', password: '' };

function initials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((p) => p[0]?.toUpperCase())
        .join('');
}

export default function Users() {
    const { t } = useTranslation();
    const toast = useToast();
    const { user: currentUser, can } = useAuth();
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [confirmUser, setConfirmUser] = useState(null);
    const [rolesUser, setRolesUser] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [roles, setRoles] = useState([]);
    const [selectedRoleIds, setSelectedRoleIds] = useState(new Set());

    const fetchUsers = useCallback(async (page, searchTerm, limit) => {
        setLoading(true);
        try {
            const { data } = await axiosClient.get('/users', {
                params: { page, limit, search: searchTerm || undefined },
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
        fetchUsers(1, '', pagination.limit);
        axiosClient.get('/permissions').then(({ data }) => setRoles(data.data)).catch(() => setRoles([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleRoleSelected = (roleId) => {
        setSelectedRoleIds((prev) => {
            const next = new Set(prev);
            if (next.has(roleId)) next.delete(roleId);
            else next.add(roleId);
            return next;
        });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchUsers(1, search, pagination.limit);
    };

    const openCreate = () => {
        setForm(emptyForm);
        setSelectedRoleIds(new Set());
        setFormOpen(true);
    };

    const openEdit = (user) => {
        setForm({ id: user.id, username: user.username, email: user.email, full_name: user.full_name, password: '' });
        setFormOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();

        if (form.id) {
            const payload = {
                email: form.email,
                full_name: form.full_name,
                ...(form.password ? { password: form.password } : {}),
            };
            const parsed = updateUserSchema.safeParse(payload);
            if (!parsed.success) {
                toast.error(getZodErrorMessage(parsed, t));
                return;
            }
        } else {
            const payload = {
                username: form.username,
                email: form.email,
                full_name: form.full_name,
                password: form.password,
                role_ids: [...selectedRoleIds],
            };
            const parsed = createUserSchema.safeParse(payload);
            if (!parsed.success) {
                toast.error(getZodErrorMessage(parsed, t));
                return;
            }
        }

        setSaving(true);
        try {
            if (form.id) {
                await axiosClient.put(`/users/${form.id}`, {
                    email: form.email,
                    full_name: form.full_name,
                    ...(form.password ? { password: form.password } : {}),
                });
                toast.success('User updated successfully');
            } else {
                await axiosClient.post('/users', {
                    username: form.username,
                    email: form.email,
                    full_name: form.full_name,
                    password: form.password,
                    role_ids: [...selectedRoleIds],
                });
                toast.success('User created successfully');
            }
            setFormOpen(false);
            fetchUsers(pagination.page, search, pagination.limit);
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const response = await axiosClient.get('/users/export', {
                params: { search: search || undefined },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `users-${Date.now()}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setExporting(false);
        }
    };

    const confirmToggleStatus = async () => {
        const user = confirmUser;
        setConfirmUser(null);
        try {
            await axiosClient.delete(`/users/${user.id}`);
            toast.success(user.status === USER_STATUS.ACTIVE ? 'User locked' : 'User unlocked');
            fetchUsers(pagination.page, search, pagination.limit);
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        }
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>{t('users.title')}</h1>
                <div className="page-header-actions">
                    <ActionGuard module={MODULE_CODE.USER} action={ACTION_CODE.EXPORT_EXCEL}>
                        <button type="button" className="btn-secondary" onClick={handleExport} disabled={exporting}>
                            {exporting ? <Spinner size={14} /> : <Download size={16} />} {t('users.export')}
                        </button>
                    </ActionGuard>
                    <ActionGuard module={MODULE_CODE.USER} action={ACTION_CODE.CREATE}>
                        <button type="button" className="btn-primary" onClick={openCreate}>
                            <Plus size={16} /> {t('users.create')}
                        </button>
                    </ActionGuard>
                </div>
            </div>

            <form className="search-bar" onSubmit={handleSearch}>
                <div className="input-with-icon search-input">
                    <Search size={16} className="input-icon-static" />
                    <input
                        type="text"
                        placeholder={t('users.search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button type="submit" className="btn-secondary">
                    Search
                </button>
            </form>

            <div className="table-wrap">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('users.columns.username')}</th>
                            <th>{t('users.columns.email')}</th>
                            <th>{t('users.columns.fullName')}</th>
                            <th>{t('users.columns.status')}</th>
                            <th>{t('users.columns.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((u) => (
                            <tr key={u.id}>
                                <td>{u.username}</td>
                                <td>{u.email}</td>
                                <td>
                                    <div className="user-cell">
                                        <span className="avatar-circle">{initials(u.full_name)}</span>
                                        {u.full_name}
                                    </div>
                                </td>
                                <td>
                                    <span className={`badge ${u.status === USER_STATUS.ACTIVE ? 'badge-active' : 'badge-locked'}`}>
                                        {u.status === USER_STATUS.ACTIVE ? t('users.status.active') : t('users.status.locked')}
                                    </span>
                                </td>
                                <td className="actions-cell">
                                    <ActionGuard module={MODULE_CODE.USER} action={ACTION_CODE.EDIT}>
                                        <button type="button" title={t('users.edit')} onClick={() => openEdit(u)}>
                                            <Pencil size={16} />
                                        </button>
                                    </ActionGuard>
                                    {u.id !== currentUser?.id && (
                                        <ActionGuard module={MODULE_CODE.USER} action={ACTION_CODE.DELETE}>
                                            <button type="button" title={t('users.lock')} onClick={() => setConfirmUser(u)}>
                                                {u.status === USER_STATUS.ACTIVE ? <Lock size={16} /> : <Unlock size={16} />}
                                            </button>
                                        </ActionGuard>
                                    )}
                                    <ActionGuard module={MODULE_CODE.PERMISSION} action={ACTION_CODE.EDIT}>
                                        <button type="button" title={t('users.manageRoles')} onClick={() => setRolesUser(u)}>
                                            <ShieldCheck size={16} />
                                        </button>
                                    </ActionGuard>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {loading && (
                    <div className="table-overlay">
                        <Spinner size={24} />
                    </div>
                )}
                {!loading && rows.length === 0 && <EmptyState message="No users found" />}
            </div>

            {pagination.totalPages > 1 && (
                <div className="pagination">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                            key={p}
                            type="button"
                            className={p === pagination.page ? 'active' : ''}
                            onClick={() => fetchUsers(p, search, pagination.limit)}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}

            {formOpen && (
                <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
                    <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
                        <h2>{form.id ? t('users.edit') : t('users.create')}</h2>

                        <div className="form-grid">
                            {!form.id && (
                                <label>
                                    {t('users.form.usernameLabel')}
                                    <input
                                        type="text"
                                        value={form.username}
                                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                                        required
                                    />
                                </label>
                            )}

                            <label>
                                {t('users.form.emailLabel')}
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
                                />
                            </label>

                            <label className={form.id ? 'form-span-2' : ''}>
                                {t('users.form.fullNameLabel')}
                                <input
                                    type="text"
                                    value={form.full_name}
                                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                    required
                                />
                            </label>

                            <label className="form-span-2">
                                {t('users.form.passwordLabel')}
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    placeholder={form.id ? 'Leave blank to keep current password' : ''}
                                    required={!form.id}
                                />
                            </label>
                        </div>

                        {!form.id && can(MODULE_CODE.PERMISSION, ACTION_CODE.EDIT) && (
                            <div>
                                <div className="modal-section-label">{t('users.form.rolesLabel')}</div>
                                <ul className="role-checklist">
                                    {roles.map((role) => (
                                        <li key={role.id}>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRoleIds.has(role.id)}
                                                    onChange={() => toggleRoleSelected(role.id)}
                                                />
                                                <span>
                                                    {role.permission_name}{' '}
                                                    <span className="role-code">({role.permission_code})</span>
                                                </span>
                                            </label>
                                        </li>
                                    ))}
                                    {roles.length === 0 && <li className="role-checklist-empty">No roles available</li>}
                                </ul>
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
                open={!!confirmUser}
                title={confirmUser?.status === USER_STATUS.ACTIVE ? t('users.lock') : t('users.unlock')}
                message={`${confirmUser?.status === USER_STATUS.ACTIVE ? t('users.lock') : t('users.unlock')} "${confirmUser?.full_name}"?`}
                confirmLabel={confirmUser?.status === USER_STATUS.ACTIVE ? t('users.lock') : t('users.unlock')}
                cancelLabel={t('users.form.cancel')}
                tone={confirmUser?.status === USER_STATUS.ACTIVE ? 'danger' : 'default'}
                onConfirm={confirmToggleStatus}
                onCancel={() => setConfirmUser(null)}
            />

            {rolesUser && <UserRolesModal user={rolesUser} onClose={() => setRolesUser(null)} />}
        </div>
    );
}
