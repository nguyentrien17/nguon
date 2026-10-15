const { verifyAccessToken } = require('./jwt');
const { ERROR_CODE } = require('#shared');
const { translate } = require('../errors/errorMessages');

// Authentication thuần kỹ thuật: xác minh access token và gán req.user. Không biết gì về
// bảng permissions hay nghiệp vụ RBAC — phần kiểm tra quyền (authorization) nằm ở
// features/permissions/permissionMiddleware.js. Xem docs/dependency-rules.md quy tắc 1.
//
// Session guard: access token là stateless nên tự nó không biết user đã bị khoá sau khi token
// được cấp. Core không được import Feature để tự tra bảng users, nên feature auth đăng ký một
// hàm kiểm tra qua setSessionGuard() lúc bootstrap (server.js). Guard trả false thì token bị
// coi như hết hiệu lực ngay, không phải chờ JWT_ACCESS_EXPIRES_IN.
let sessionGuard = null;

function setSessionGuard(fn) {
    sessionGuard = fn;
}

function rejectExpired(req, res) {
    // Dùng TOKEN_EXPIRED (không phải ACCOUNT_DISABLED) có chủ ý: client gặp mã này sẽ gọi
    // /auth/refresh, refresh từ chối user bị khoá, và client tự xoá phiên — đúng hành vi cần có.
    return res.status(401).json({
        success: false,
        errorCode: ERROR_CODE.TOKEN_EXPIRED,
        message: translate(ERROR_CODE.TOKEN_EXPIRED, req.locale) || 'Access token invalid or expired',
    });
}

async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            errorCode: ERROR_CODE.UNAUTHORIZED,
            message: translate(ERROR_CODE.UNAUTHORIZED, req.locale) || 'Missing access token',
        });
    }

    let payload;
    try {
        payload = verifyAccessToken(token);
    } catch {
        return rejectExpired(req, res);
    }

    try {
        if (sessionGuard && !(await sessionGuard(payload))) {
            return rejectExpired(req, res);
        }
    } catch (err) {
        return next(err);
    }

    req.user = payload; // { id, username } — permissions are re-checked live against the DB, not trusted from the token
    next();
}

module.exports = { authenticate, setSessionGuard };
