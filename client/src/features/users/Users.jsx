import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Unlock, Pencil, Plus, ShieldCheck, Download } from 'lucide-react';
import ActionGuard from '@/core/permissions/ActionGuard';
import { Badge, Button, ConfirmDialog, DataTable, IconButton, Pagination, SearchBar } from '@/components/ui';
import usePagedList from '@/hooks/usePagedList';
import { downloadFile } from '@/lib/downloadFile';
import { useToast } from '@/app/providers/ToastContext';
import { useSession } from '@/core/auth/SessionContext';
import { MODULE_CODE, ACTION_CODE, USER_STATUS } from '@shared/constants.json';
import { getErrorMessage } from '@/core/errors/errorMessage';
import UserFormModal from './UserFormModal';
import UserRolesModal from './UserRolesModal';
import { exportUsers, listUsers, setUserStatus } from './userApi';

function initials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((p) => p[0]?.toUpperCase())
        .join('');
}

// Trang danh sách user: tìm kiếm, bảng, phân trang, xuất Excel, khoá/mở khoá.
// Form tạo/sửa ở UserFormModal, gán role ở UserRolesModal, lời gọi API ở userApi.
export default function Users() {
    const { t } = useTranslation();
    const toast = useToast();
    const { user: currentUser } = useSession();
    const list = usePagedList(listUsers, { limit: 10, initialFilters: { search: '' } });
    const [search, setSearch] = useState('');
    // undefined = form đóng, null = tạo mới, object = đang sửa user đó.
    const [editing, setEditing] = useState(undefined);
    const [confirmUser, setConfirmUser] = useState(null);
    const [toggling, setToggling] = useState(false);
    const [rolesUser, setRolesUser] = useState(null);
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            // Xuất theo bộ lọc ĐANG ÁP DỤNG (khớp danh sách đang hiển thị), không theo chữ đang gõ dở.
            const blob = await exportUsers({ search: list.filters.search || undefined });
            downloadFile(blob, `users-${Date.now()}.xlsx`);
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setExporting(false);
        }
    };

    const confirmToggleStatus = async () => {
        const user = confirmUser;
        setToggling(true);
        try {
            // Gửi trạng thái ĐÍCH (không phải "đảo"): bấm 2 lần / retry không mở khoá lại.
            await setUserStatus(user.id, user.status === USER_STATUS.ACTIVE ? USER_STATUS.LOCKED : USER_STATUS.ACTIVE);
            toast.success(user.status === USER_STATUS.ACTIVE ? t('users.lockedToast') : t('users.unlockedToast'));
            list.reload();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setToggling(false);
            setConfirmUser(null);
        }
    };

    const isLocking = confirmUser?.status === USER_STATUS.ACTIVE;

    const columns = [
        { key: 'username', header: t('users.columns.username') },
        { key: 'email', header: t('users.columns.email') },
        {
            key: 'full_name',
            header: t('users.columns.fullName'),
            render: (u) => (
                <div className="user-cell">
                    <span className="avatar-circle">{initials(u.full_name)}</span>
                    {u.full_name}
                </div>
            ),
        },
        {
            key: 'status',
            header: t('users.columns.status'),
            render: (u) =>
                u.status === USER_STATUS.ACTIVE ? (
                    <Badge tone="success">{t('users.status.active')}</Badge>
                ) : (
                    <Badge tone="danger">{t('users.status.locked')}</Badge>
                ),
        },
        {
            key: 'actions',
            header: t('users.columns.actions'),
            className: 'actions-cell',
            render: (u) => (
                <>
                    <ActionGuard module={MODULE_CODE.USER} action={ACTION_CODE.EDIT}>
                        <IconButton icon={Pencil} label={t('users.edit')} onClick={() => setEditing(u)} />
                    </ActionGuard>
                    {u.id !== currentUser?.id && (
                        <ActionGuard module={MODULE_CODE.USER} action={ACTION_CODE.LOCK}>
                            <IconButton
                                icon={u.status === USER_STATUS.ACTIVE ? Lock : Unlock}
                                label={u.status === USER_STATUS.ACTIVE ? t('users.lock') : t('users.unlock')}
                                tone={u.status === USER_STATUS.ACTIVE ? 'danger' : 'default'}
                                onClick={() => setConfirmUser(u)}
                            />
                        </ActionGuard>
                    )}
                    <ActionGuard module={MODULE_CODE.PERMISSION} action={ACTION_CODE.EDIT}>
                        <IconButton icon={ShieldCheck} label={t('users.manageRoles')} onClick={() => setRolesUser(u)} />
                    </ActionGuard>
                </>
            ),
        },
    ];

    return (
        <div className="page">
            <div className="page-header">
                <h1>{t('users.title')}</h1>
                <div className="page-header-actions">
                    <ActionGuard module={MODULE_CODE.USER} action={ACTION_CODE.EXPORT_EXCEL}>
                        <Button icon={Download} onClick={handleExport} loading={exporting}>
                            {t('users.export')}
                        </Button>
                    </ActionGuard>
                    <ActionGuard module={MODULE_CODE.USER} action={ACTION_CODE.CREATE}>
                        <Button variant="primary" icon={Plus} onClick={() => setEditing(null)}>
                            {t('users.create')}
                        </Button>
                    </ActionGuard>
                </div>
            </div>

            <SearchBar
                value={search}
                onChange={setSearch}
                onSearch={(value) => list.applyFilters({ search: value })}
                placeholder={t('users.search')}
            />

            <DataTable columns={columns} rows={list.rows} loading={list.loading} emptyMessage={t('users.empty')} />

            <Pagination pagination={list.pagination} onChange={list.goToPage} disabled={list.loading} />

            <UserFormModal open={editing !== undefined} user={editing} onClose={() => setEditing(undefined)} onSaved={list.reload} />

            <ConfirmDialog
                open={!!confirmUser}
                title={isLocking ? t('users.lock') : t('users.unlock')}
                message={`${isLocking ? t('users.lock') : t('users.unlock')} "${confirmUser?.full_name}"?`}
                confirmLabel={isLocking ? t('users.lock') : t('users.unlock')}
                cancelLabel={t('users.form.cancel')}
                tone={isLocking ? 'danger' : 'default'}
                loading={toggling}
                onConfirm={confirmToggleStatus}
                onCancel={() => setConfirmUser(null)}
            />

            {rolesUser && <UserRolesModal user={rolesUser} onClose={() => setRolesUser(null)} />}
        </div>
    );
}
