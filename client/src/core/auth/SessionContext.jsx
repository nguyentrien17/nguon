import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axiosClient, { setAccessToken, setSigningKey, setOnUnauthorized, setOnPermissionDenied, refreshSession } from '@/core/api/axiosClient';
import { PermissionsProvider } from '@/core/permissions/PermissionsContext';
import { useToast } from '@/app/providers/ToastContext';

const SessionContext = createContext(null);

// Đồng bộ quyền không quá 1 lần / 30 giây (nhiều request 403 cùng lúc chỉ kích hoạt một lần);
// quay lại tab sau hơn 5 phút thì tự đồng bộ.
const SYNC_THROTTLE_MS = 30 * 1000;
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * Phiên đăng nhập: user hiện tại, login/logout, khôi phục phiên khi tải lại trang, đồng bộ quyền.
 *
 * Danh sách quyền đến trong cùng payload login/refresh nên được giữ ở đây, nhưng PHÂN PHÁT qua
 * PermissionsProvider (usePermissions) — component chỉ cần hỏi quyền không phụ thuộc vào phiên.
 */
export function SessionProvider({ children }) {
    const { t } = useTranslation();
    const toast = useToast();
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const isAuthenticated = useRef(false);
    const lastSyncAt = useRef(0);

    const applySession = useCallback((data) => {
        setAccessToken(data.accessToken);
        setSigningKey(data.signingKey);
        setUser((prev) => ({ ...prev, ...data.user }));
        setPermissions(data.permissions);
        lastSyncAt.current = Date.now();
    }, []);

    const clearSession = useCallback(() => {
        setAccessToken(null);
        setSigningKey(null);
        setUser(null);
        setPermissions([]);
    }, []);

    // Quyền nằm trong payload login/refresh, nên đổi role của user đang đăng nhập không tự phản
    // ánh lên giao diện. Gọi refresh để lấy danh sách quyền mới (refreshSession gộp các lời gọi
    // song song). Lỗi ở đây không xoá phiên — interceptor của axiosClient lo việc đó.
    const syncPermissions = useCallback(async () => {
        if (Date.now() - lastSyncAt.current < SYNC_THROTTLE_MS) return;
        lastSyncAt.current = Date.now();
        try {
            const { data } = await refreshSession();
            applySession(data);
        } catch {
            /* giữ phiên hiện tại */
        }
    }, [applySession]);

    useEffect(() => {
        isAuthenticated.current = !!user;
    }, [user]);

    useEffect(() => {
        setOnUnauthorized(() => {
            if (isAuthenticated.current) toast.info(t('common.sessionExpired'));
            clearSession();
        });
        setOnPermissionDenied(() => {
            if (isAuthenticated.current) syncPermissions();
        });
    }, [clearSession, syncPermissions, toast, t]);

    useEffect(() => {
        const onFocus = () => {
            if (isAuthenticated.current && Date.now() - lastSyncAt.current > STALE_AFTER_MS) syncPermissions();
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [syncPermissions]);

    // Khôi phục phiên khi tải lại trang (dựa vào HttpOnly refreshToken cookie).
    useEffect(() => {
        (async () => {
            try {
                const { data } = await refreshSession();
                applySession(data);
            } catch {
                clearSession();
            } finally {
                setLoading(false);
            }
        })();
    }, [applySession, clearSession]);

    const login = useCallback(
        async (username, password) => {
            const { data } = await axiosClient.post('/auth/login', { username, password });
            setUser(null); // phiên mới: không gộp với user của phiên trước
            applySession(data);
            return data;
        },
        [applySession]
    );

    const logout = useCallback(async () => {
        try {
            await axiosClient.post('/auth/logout');
        } finally {
            clearSession();
        }
    }, [clearSession]);

    const refreshProfile = useCallback(async () => {
        const { data } = await axiosClient.get('/auth/me');
        setUser((prev) => ({ ...prev, ...data.data }));
    }, []);

    const value = useMemo(
        () => ({ user, isAuthenticated: !!user, loading, login, logout, refreshProfile, syncPermissions }),
        [user, loading, login, logout, refreshProfile, syncPermissions]
    );

    return (
        <SessionContext.Provider value={value}>
            <PermissionsProvider permissions={permissions}>{children}</PermissionsProvider>
        </SessionContext.Provider>
    );
}

/** { user, isAuthenticated, loading, login, logout, refreshProfile, syncPermissions } */
// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error('useSession must be used within AuthProvider');
    return ctx;
}
