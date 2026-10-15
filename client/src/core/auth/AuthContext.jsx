import { SessionProvider } from './SessionContext';
import { ModulesProvider } from '@/core/permissions/ModulesContext';

/**
 * Ghép ba context xác thực / phân quyền — trước đây là MỘT context gánh cả ba việc:
 *
 *   useSession()      @/core/auth/SessionContext         user, login/logout, khôi phục phiên
 *   usePermissions()  @/core/permissions/PermissionsContext  can(), canOpenModule()
 *   useModules()      @/core/permissions/ModulesContext      modules, getModuleByElementId()
 *
 * Component dùng đúng hook mình cần — ActionGuard không phụ thuộc vào phiên, Login không phụ
 * thuộc vào danh sách module. Phải nằm TRONG ToastProvider (SessionProvider báo hết phiên qua toast).
 */
export function AuthProvider({ children }) {
    return (
        <SessionProvider>
            <ModulesProvider>{children}</ModulesProvider>
        </SessionProvider>
    );
}
