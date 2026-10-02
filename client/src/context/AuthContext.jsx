import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import axiosClient, { setAccessToken, setSigningKey, setOnUnauthorized } from '../api/axiosClient';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const wasAuthenticated = useRef(false);

    const clearSession = useCallback(() => {
        setAccessToken(null);
        setSigningKey(null);
        setUser(null);
        setPermissions([]);
        setModules([]);
    }, []);

    useEffect(() => {
        setOnUnauthorized(() => {
            if (wasAuthenticated.current) {
                toast.info('Your session has expired. Please sign in again.');
            }
            clearSession();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clearSession]);

    useEffect(() => {
        wasAuthenticated.current = !!user;
    }, [user]);

    // Modules được nạp riêng (không phải từ payload login/refresh) vì cần cho mọi trang có
    // dùng ActionGuard elementId={...}, không chỉ Sidebar — nạp lại mỗi khi có user mới.
    useEffect(() => {
        if (!user) return;
        axiosClient
            .get('/modules')
            .then(({ data }) => setModules(data.data))
            .catch(() => setModules([]));
    }, [user]);

    useEffect(() => {
        // Thử refresh session khi tải lại trang (dựa vào HttpOnly refreshToken cookie)
        (async () => {
            try {
                const { data } = await axiosClient.post('/auth/refresh');
                setAccessToken(data.accessToken);
                setSigningKey(data.signingKey);
                setUser(data.user);
                setPermissions(data.permissions);
            } catch {
                clearSession();
            } finally {
                setLoading(false);
            }
        })();
    }, [clearSession]);

    const login = useCallback(async (username, password) => {
        const { data } = await axiosClient.post('/auth/login', { username, password });
        setAccessToken(data.accessToken);
        setSigningKey(data.signingKey);
        setUser(data.user);
        setPermissions(data.permissions);
        return data;
    }, []);

    const logout = useCallback(async () => {
        try {
            await axiosClient.post('/auth/logout');
        } finally {
            clearSession();
        }
    }, [clearSession]);

    const can = useCallback(
        (moduleCode, actionCode) =>
            permissions.some((p) => p.module_code === moduleCode && p.action_code === actionCode),
        [permissions]
    );

    // True if the user has been granted ANY action on this module — used to decide sidebar
    // visibility so a module isn't hidden just because its "view-equivalent" action isn't
    // literally coded 'view' (custom action codes are allowed when creating actions).
    const canAccessModule = useCallback(
        (moduleCode) => permissions.some((p) => p.module_code === moduleCode),
        [permissions]
    );

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
                canAccessModule,
                getModuleByElementId,
                refreshProfile,
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
