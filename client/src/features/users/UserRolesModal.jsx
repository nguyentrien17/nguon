import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/app/providers/ToastContext';
import { Button, Modal, Spinner } from '@/components/ui';
import { getErrorMessage } from '@/core/errors/errorMessage';
import { assignRole, listRoles, listUserRoles, unassignRole } from './userApi';

// Gán / gỡ role cho một user. Mỗi lần tích là một request riêng (không có nút Lưu).
export default function UserRolesModal({ user, onClose }) {
    const { t } = useTranslation();
    const toast = useToast();
    const [allRoles, setAllRoles] = useState([]);
    const [userRoleIds, setUserRoleIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [pendingId, setPendingId] = useState(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [rolesRes, userRolesRes] = await Promise.all([listRoles(), listUserRoles(user.id)]);
                setAllRoles(rolesRes.data);
                setUserRoleIds(new Set(userRolesRes.data.map((r) => r.id)));
            } catch (err) {
                toast.error(getErrorMessage(err, t));
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.id]);

    const toggleRole = async (role) => {
        const isAssigned = userRoleIds.has(role.id);

        // Optimistic update: reflect the click immediately so the controlled
        // checkbox doesn't snap back to its old value while the request is in flight.
        setUserRoleIds((prev) => {
            const next = new Set(prev);
            if (isAssigned) next.delete(role.id);
            else next.add(role.id);
            return next;
        });
        setPendingId(role.id);

        const params = { role: role.permission_name, user: user.full_name };
        try {
            if (isAssigned) {
                await unassignRole(role.id, user.id);
                toast.success(t('users.roleRemoved', params));
            } else {
                await assignRole(role.id, user.id);
                toast.success(t('users.roleAssigned', params));
            }
        } catch (err) {
            // Rollback on failure
            setUserRoleIds((prev) => {
                const next = new Set(prev);
                if (isAssigned) next.add(role.id);
                else next.delete(role.id);
                return next;
            });
            toast.error(getErrorMessage(err, t));
        } finally {
            setPendingId(null);
        }
    };

    return (
        <Modal
            open
            title={t('users.manageRoles')}
            onClose={onClose}
            footer={
                <Button variant="primary" onClick={onClose}>
                    {t('common.close')}
                </Button>
            }
        >
            <p className="modal-subtitle">{user.full_name}</p>

            {loading ? (
                <div className="table-overlay-static">
                    <Spinner size={22} />
                </div>
            ) : (
                <ul className="role-checklist">
                    {allRoles.map((role) => (
                        <li key={role.id}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={userRoleIds.has(role.id)}
                                    disabled={pendingId === role.id}
                                    onChange={() => toggleRole(role)}
                                />
                                <span>
                                    {role.permission_name} <span className="role-code">({role.permission_code})</span>
                                </span>
                                {pendingId === role.id && <Spinner size={14} />}
                            </label>
                        </li>
                    ))}
                    {allRoles.length === 0 && <li className="role-checklist-empty">{t('users.noRoles')}</li>}
                </ul>
            )}
        </Modal>
    );
}
