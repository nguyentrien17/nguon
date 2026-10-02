const permissionModel = require('./permissionModel');
const { PROTECTED_ROLE_CODE, ERROR_CODE } = require('#shared');
const { translate } = require('#core/errors/errorMessages');

// Authorization (kiểm tra quyền) — tách khỏi core/security/authenticate.js vì nó phụ thuộc
// vào bảng permissions/permission_details của feature này. Core không được import Feature
// (docs/dependency-rules.md quy tắc 1), nên middleware này thuộc về đây.
//
// Fetches the caller's current permissions straight from the DB so that a role/permission
// change (edit, revoke, delete) takes effect on their very next request instead of waiting
// for their access token to expire and refresh (previously up to JWT_ACCESS_EXPIRES_IN late).
function denyResponse(res, locale, moduleCode, actionCode, fallback) {
    return res.status(403).json({
        success: false,
        errorCode: ERROR_CODE.PERMISSION_DENIED,
        message: translate(ERROR_CODE.PERMISSION_DENIED, locale, { module: moduleCode, action: actionCode }) || fallback,
    });
}

function requirePermission(moduleCode, actionCode) {
    return async (req, res, next) => {
        try {
            const { isProtectedRole, permissions } = await permissionModel.getUserAccess(req.user.id, PROTECTED_ROLE_CODE);
            if (isProtectedRole) {
                return next();
            }

            const allowed = permissions.some((p) => p.module_code === moduleCode && p.action_code === actionCode);

            if (!allowed) {
                return denyResponse(res, req.locale, moduleCode, actionCode, `Missing permission ${moduleCode}:${actionCode}`);
            }
            next();
        } catch (err) {
            next(err);
        }
    };
}

/**
 * Cho phép truy cập nếu user có ÍT NHẤT MỘT trong các quyền truyền vào.
 * Mỗi quyền viết dạng chuỗi "module:action", ví dụ:
 *   requireAnyPermission('MOD_USER:view', 'MOD_PERMISSION:view')
 */
function requireAnyPermission(...codes) {
    const pairs = codes.map((code) => code.split(':'));

    return async (req, res, next) => {
        try {
            const { isProtectedRole, permissions } = await permissionModel.getUserAccess(req.user.id, PROTECTED_ROLE_CODE);
            if (isProtectedRole) {
                return next();
            }

            const allowed = pairs.some(([moduleCode, actionCode]) =>
                permissions.some((p) => p.module_code === moduleCode && p.action_code === actionCode)
            );

            if (!allowed) {
                const [firstModule, firstAction] = pairs[0] || [];
                return denyResponse(res, req.locale, firstModule, firstAction, `Missing one of permissions: ${codes.join(', ')}`);
            }
            next();
        } catch (err) {
            next(err);
        }
    };
}

module.exports = { requirePermission, requireAnyPermission };
