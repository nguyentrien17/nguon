import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axiosClient, { setAccessToken, setSigningKey, setOnUnauthorized, setOnPermissionDenied, refreshSession } from '@/core/api/axiosClient';
import { canOpenModule as canOpenModuleRule } from '@/core/permissions/moduleAccess';
import { useToast } from '@/app/providers/ToastContext';

const AuthContext = createContext(null);

// Đồng bộ quyền không quá 1 lần / 30 giây (nhiều request 403 cùng lúc chỉ kích hoạt một lần);
// quay lại tab sau hơn 5 phút thì tự đồng bộ.
const SYNC_THROTTLE_MS = 30 * 1000;
const STALE_AFTER_MS = 5 * 60 * 1000;

export function AuthProvider({ children }) {
    const { t } = useTranslation();
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const wasAuthenticated = useRef(false);
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
        setModules([]);
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
        setOnUnauthorized(() => {
            if (wasAuthenticated.current) {
                toast.info(t('common.sessionExpired'));
            }
            clearSession();
        });
        setOnPermissionDenied(() => {
            if (wasAuthenticated.current) syncPermissions();
        });
    }, [clearSession, syncPermissions, toast, t]);

    useEffect(() => {
        const onFocus = () => {
            if (wasAuthenticated.current && Date.now() - lastSyncAt.current > STALE_AFTER_MS) syncPermissions();
        };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [syncPermissions]);

    useEffect(() => {
        wasAuthenticated.current = !!user;
    }, [user]);

    // Modules được nạp riêng (không phải từ payload login/refresh) vì cần cho mọi trang có
    // dùng ActionGuard elementId={...} và cho Sidebar — nạp lại mỗi khi có user mới.
    const userId = user?.id;
    useEffect(() => {
        if (!userId) return;
        axiosClient
            .get('/modules')
            .then(({ data }) => setModules(data.data))
            .catch(() => setModules([]));
    }, [userId]);

    useEffect(() => {
        // Thử khôi phục phiên khi tải lại trang (dựa vào HttpOnly refreshToken cookie)
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

    const can = useCallback(
        (moduleCode, actionCode) => permissions.some((p) => p.module_code === moduleCode && p.action_code === actionCode),
        [permissions]
    );

    // Có mở được module không — cùng một quy tắc cho Sidebar và ProtectedRoute
    // (core/permissions/moduleAccess.js).
    const canOpenModule = useCallback((moduleCode) => canOpenModuleRule(moduleCode, permissions), [permissions]);

    const refreshProfile = useCallback(async () => {
        const { data } = await axiosClient.get('/auth/me');
        setUser((prev) => ({ ...prev, ...data.data }));
    }, []);

    const moduleByElementId = useMemo(() => {
        const map = new Map();
        modules.forEach((m) => {
            if (m.module_element_id) map.set(m.module_element_id, m);
        });
        return map;
    }, [modules]);

    const getModuleByElementId = useCallback((elementId) => moduleByElementId.get(elementId), [moduleByElementId]);

    return (
        <AuthContext.Provider
            value={{
                user,
                permissions,
                modules,
                loading,
                login,
                logout,
                can,
                canOpenModule,
                getModuleByElementId,
                refreshProfile,
                syncPermissions,
                isAuthenticated: !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
