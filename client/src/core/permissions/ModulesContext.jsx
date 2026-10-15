import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axiosClient from '@/core/api/axiosClient';
import { useSession } from '@/core/auth/SessionContext';

const ModulesContext = createContext(null);

/**
 * Danh sách module của hệ thống — dùng cho Sidebar (menu) và ActionGuard elementId={...} (tra
 * module theo module_element_id). Nạp lại mỗi khi có phiên của user khác; không nạp lại khi chỉ
 * đổi hồ sơ / đồng bộ quyền của cùng user.
 */
export function ModulesProvider({ children }) {
    const { user } = useSession();
    const userId = user?.id;
    const [modules, setModules] = useState([]);

    useEffect(() => {
        if (!userId) return undefined;
        let cancelled = false;
        axiosClient
            .get('/modules')
            .then(({ data }) => !cancelled && setModules(data.data))
            .catch(() => !cancelled && setModules([]));
        return () => {
            cancelled = true; // đổi user giữa chừng: bỏ kết quả của lần nạp cũ
        };
    }, [userId]);

    const value = useMemo(() => {
        const byElementId = new Map(modules.filter((m) => m.module_element_id).map((m) => [m.module_element_id, m]));
        return {
            // Đăng xuất: không trả danh sách của phiên trước.
            modules: userId ? modules : [],
            getModuleByElementId: (elementId) => (userId ? byElementId.get(elementId) : undefined),
        };
    }, [modules, userId]);

    return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

/** { modules, getModuleByElementId(elementId) } */
// eslint-disable-next-line react-refresh/only-export-components
export function useModules() {
    const ctx = useContext(ModulesContext);
    if (!ctx) throw new Error('useModules must be used within AuthProvider');
    return ctx;
}
