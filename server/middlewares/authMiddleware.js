const { verifyAccessToken } = require('../utils/jwt');
const permissionModel = require('#features/permissions/permissionModel');
const { PROTECTED_ROLE_CODE, ERROR_CODE } = require('#shared');
const { translate } = require('../utils/errorMessages');

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            errorCode: ERROR_CODE.UNAUTHORIZED,
            message: translate(ERROR_CODE.UNAUTHORIZED, req.locale) || 'Missing access token',
        });
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = payload; // { id, username } — permissions are re-checked live against the DB, not trusted from the token
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            errorCode: ERROR_CODE.TOKEN_EXPIRED,
            message: translate(ERROR_CODE.TOKEN_EXPIRED, req.locale) || 'Access token invalid or expired',
        });
    }
}

// Fetches the caller's current permissions straight from the DB so that a role/permission
// change (edit, revoke, delete) takes effect on their very next request instead of waiting
// for their access token to expire and refresh (previously up to JWT_ACCESS_EXPIRES_IN late).
function requirePermission(moduleCode, actionCode) {
    return async (req, res, next) => {
        try {
            const { isProtectedRole, permissions } = await permissionModel.getUserAccess(req.user.id, PROTECTED_ROLE_CODE);
            if (isProtectedRole) {
                return next();
            }

            const allowed = permissions.some((p) => p.module_code === moduleCode && p.action_code === actionCode);

            if (!allowed) {
                return res.status(403).json({
                    success: false,
                    errorCode: ERROR_CODE.PERMISSION_DENIED,
                    message:
                        translate(ERROR_CODE.PERMISSION_DENIED, req.locale, { module: moduleCode, action: actionCode }) ||
                        `Missing permission ${moduleCode}:${actionCode}`,
                });
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
                return res.status(403).json({
                    success: false,
                    errorCode: ERROR_CODE.PERMISSION_DENIED,
                    message:
                        translate(ERROR_CODE.PERMISSION_DENIED, req.locale, { module: firstModule, action: firstAction }) ||
                        `Missing one of permissions: ${codes.join(', ')}`,
                });
            }
            next();
        } catch (err) {
            next(err);
        }
    };
}

module.exports = { authenticate, requirePermission, requireAnyPermission };
