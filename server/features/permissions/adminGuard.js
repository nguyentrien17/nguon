const permissionModel = require('./permissionModel');
const AppError = require('#core/errors/AppError');
const { ERROR_CODE, PROTECTED_ROLE_CODE, USER_STATUS } = require('#shared');

/**
 * Quy tắc "hệ thống luôn còn ít nhất một Administrator đang hoạt động".
 *
 * Gọi BÊN TRONG transaction, NGAY TRƯỚC thao tác sẽ làm `userId` mất tư cách admin hoạt động
 * (khoá tài khoản, gỡ role Administrator). Hàm khoá các dòng admin (FOR UPDATE) nên hai thao tác
 * song song — A khoá B trong khi B khoá A — xếp hàng: thao tác sau thấy kết quả của thao tác
 * trước và bị từ chối, thay vì cả hai cùng thành công rồi không còn admin nào để mở khoá.
 *
 * Dùng chung bởi userService.setUserStatus và permissionService.unassignRoleFromUser.
 */
async function assertKeepsActiveAdmin(userId, trx) {
    const activeAdminIds = await permissionModel.lockActiveProtectedUserIds(PROTECTED_ROLE_CODE, USER_STATUS.ACTIVE, trx);
    const target = Number(userId);
    if (activeAdminIds.includes(target) && activeAdminIds.every((id) => id === target)) {
        throw new AppError(409, ERROR_CODE.LAST_ADMIN, 'The system must keep at least one active Administrator');
    }
}

/**
 * Chỉ Administrator mới được gán / gỡ role Administrator.
 *
 * MOD_PERMISSION:edit là quyền "quản lý phân quyền" thông thường; nếu nó đủ để gán ROLE_ADMIN thì
 * người có quyền đó tự gán ROLE_ADMIN cho mình là thành admin — vượt qua mọi kiểm tra quyền chi
 * tiết (permissionMiddleware cho protected role qua hết). Cùng nguyên tắc với guard đổi
 * email/mật khẩu admin ở userService.assertCanTakeOverAccount.
 *
 * Dùng chung bởi permissionService (gán/gỡ role) và userService.createUser (gán role lúc tạo user).
 */
async function assertCanManageProtectedRole(actorId) {
    const { isProtectedRole } = await permissionModel.getUserAccess(actorId, PROTECTED_ROLE_CODE);
    if (!isProtectedRole) {
        throw new AppError(403, ERROR_CODE.PROTECTED_ROLE, 'Only an Administrator can assign or remove the Administrator role', {
            actionKey: 'assign',
        });
    }
}

module.exports = { assertKeepsActiveAdmin, assertCanManageProtectedRole };
