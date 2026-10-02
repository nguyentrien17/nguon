const { verifyAccessToken } = require('./jwt');
const { ERROR_CODE } = require('#shared');
const { translate } = require('../errors/errorMessages');

// Authentication thuần kỹ thuật: xác minh access token và gán req.user. Không biết gì về
// bảng permissions hay nghiệp vụ RBAC — phần kiểm tra quyền (authorization) nằm ở
// features/permissions/permissionMiddleware.js. Xem docs/dependency-rules.md quy tắc 1.
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

module.exports = { authenticate };
