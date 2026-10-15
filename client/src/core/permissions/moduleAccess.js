import { MODULE_CODE, ACTION_CODE } from '@shared/constants.json';

// Module có route riêng trong app/router/AppRoutes.jsx, được <ProtectedRoute moduleCode> chặn bằng
// quyền VIEW — đồng thời API danh sách của chúng ở backend cũng đòi đúng quyền VIEW.
// Thêm route mới có ProtectedRoute moduleCode=... thì thêm mã module vào đây.
export const ROUTE_GUARDED_MODULES = new Set([MODULE_CODE.USER, MODULE_CODE.PERMISSION, MODULE_CODE.AUDIT, MODULE_CODE.MODULE_ACTION]);

/**
 * Người dùng có MỞ ĐƯỢC module này không — nguồn quy tắc duy nhất cho cả Sidebar lẫn
 * ProtectedRoute, để menu không bao giờ hiện một mục mà bấm vào lại bị đẩy về Dashboard.
 *
 *   - Module có route được chặn: cần đúng quyền VIEW (khớp ProtectedRoute + API backend).
 *   - Module tạo thêm qua màn Module & Action (action code tuỳ ý, có thể không có 'view'):
 *     chỉ cần có BẤT KỲ quyền nào trên module.
 *
 * Chỉ để hiển thị cho đúng; quyền thật luôn được backend kiểm tra lại ở mọi request.
 */
export function canOpenModule(moduleCode, permissions) {
    if (ROUTE_GUARDED_MODULES.has(moduleCode)) {
        return permissions.some((p) => p.module_code === moduleCode && p.action_code === ACTION_CODE.VIEW);
    }
    return permissions.some((p) => p.module_code === moduleCode);
}
