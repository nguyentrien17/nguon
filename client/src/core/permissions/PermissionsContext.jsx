import { createContext, useContext, useMemo } from 'react';
import { canOpenModule } from './moduleAccess';

const PermissionsContext = createContext(null);

/**
 * Danh sách quyền của user hiện tại + các hàm hỏi quyền. Danh sách đến từ payload
 * login/refresh — SessionProvider truyền xuống qua prop `permissions`.
 *
 * Chỉ để hiển thị đúng (ẩn nút, ẩn menu); quyền thật luôn được backend kiểm tra lại.
 */
export function PermissionsProvider({ permissions, children }) {
    const value = useMemo(
        () => ({
            permissions,
            can: (moduleCode, actionCode) => permissions.some((p) => p.module_code === moduleCode && p.action_code === actionCode),
            // Cùng quy tắc cho Sidebar và ProtectedRoute — xem moduleAccess.js.
            canOpenModule: (moduleCode) => canOpenModule(moduleCode, permissions),
        }),
        [permissions]
    );
    return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

/** { permissions, can(moduleCode, actionCode), canOpenModule(moduleCode) } */
// eslint-disable-next-line react-refresh/only-export-components
export function usePermissions() {
    const ctx = useContext(PermissionsContext);
    if (!ctx) throw new Error('usePermissions must be used within AuthProvider');
    return ctx;
}
