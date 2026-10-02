import { useAuth } from '@/core/auth/AuthContext';

/**
 * Ẩn/khóa các nút thao tác (create/edit/delete/export...) dựa trên quyền của user hiện tại.
 * Dùng: <ActionGuard module={MODULE_CODE.USER} action={ACTION_CODE.CREATE}><button>...</button></ActionGuard>
 * Hoặc gate theo module_element_id (dùng cho module loại Function/Screen, không có MODULE_CODE cố định):
 * <ActionGuard elementId="btn-export-excel" action={ACTION_CODE.EXPORT_EXCEL}><button>...</button></ActionGuard>
 */
export default function ActionGuard({ module, action, elementId, children }) {
    const { can, getModuleByElementId } = useAuth();
    const moduleCode = elementId ? getModuleByElementId(elementId)?.module_code : module;
    if (!moduleCode || !can(moduleCode, action)) return null;
    return children;
}
