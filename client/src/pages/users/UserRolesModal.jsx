import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axiosClient from '../../api/axiosClient';
import { useToast } from '../../context/ToastContext';
import Spinner from '../../components/Spinner';
import { getErrorMessage } from '../../utils/errorMessage';

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
                const [rolesRes, userRolesRes] = await Promise.all([
                    axiosClient.get('/permissions'),
                    axiosClient.get(`/users/${user.id}/roles`),
                ]);
                setAllRoles(rolesRes.data.data);
                setUserRoleIds(new Set(userRolesRes.data.data.map((r) => r.id)));
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

        try {
            if (isAssigned) {
                await axiosClient.delete(`/permissions/${role.id}/assign`, { data: { user_id: user.id } });
                toast.success(`Removed "${role.permission_name}" from ${user.full_name}`);
            } else {
                await axiosClient.post(`/permissions/${role.id}/assign`, { user_id: user.id });
                toast.success(`Assigned "${role.permission_name}" to ${user.full_name}`);
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
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h2>Manage roles</h2>
                <p className="modal-subtitle">{user.full_name}</p>

                {loading ? (
                    <div className="table-overlay-static">
                        <Spinner size={22} />
                    </div>
                ) : (
                    <ul className="role-checklist">
                        {allRoles.map((role) => {
                            const checked = userRoleIds.has(role.id);
                            return (
                                <li key={role.id}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={pendingId === role.id}
                                            onChange={() => toggleRole(role)}
                                        />
                                        <span>
                                            {role.permission_name}{' '}
                                            <span className="role-code">({role.permission_code})</span>
                                        </span>
                                        {pendingId === role.id && <Spinner size={14} />}
                                    </label>
                                </li>
                            );
                        })}
                        {allRoles.length === 0 && <li className="role-checklist-empty">No roles available</li>}
                    </ul>
                )}

                <div className="modal-actions">
                    <button type="button" className="btn-primary" onClick={onClose}>
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
