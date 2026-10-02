const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const ms = require('ms');
const userModel = require('#features/users/userModel');
const refreshTokenModel = require('./refreshTokenModel');
const passwordResetTokenModel = require('./passwordResetTokenModel');
const permissionModel = require('#features/permissions/permissionModel');
const auditLogModel = require('#features/audit-logs/auditLogModel');
const AppError = require('../../utils/AppError');
const { buildFieldDiff } = require('../../utils/auditDiff');
const { sendPasswordResetEmail } = require('../../utils/mailer');
const { signAccessToken, signRefreshToken, verifyRefreshToken, REFRESH_EXPIRES_IN } = require('../../utils/jwt');
const { USER_STATUS, AUDIT_STATUS, AUDIT_ACTION, ERROR_CODE } = require('#shared');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = ms('15m');
const REFRESH_COOKIE_NAME = 'refreshToken';
const RESET_TOKEN_TTL_MS = ms('30m');

// Hash "giả" dùng để chạy bcrypt.compare khi username không tồn tại, để thời gian phản hồi
// tương đương trường hợp sai password — tránh lộ username hợp lệ qua timing (bcrypt.compare
// tốn vài chục ms, trong khi trả lỗi ngay gần như tức thời).
const DUMMY_PASSWORD_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8i7SgAULsCoNQ9Xf6b8L7wtqzZ9Xoi';

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function toPublicUser(user) {
    return { id: user.id, username: user.username, email: user.email, full_name: user.full_name, avatar: user.avatar };
}

async function issueSession(user) {
    const permissions = await permissionModel.getUserPermissions(user.id);
    // Secret ký request riêng cho phiên này — sinh mới mỗi lần login/refresh, nhúng vào JWT
    // (server tự xác minh lại được, không cần lưu DB) và trả riêng cho client để client không
    // phải tự giải mã JWT. Xem server/middlewares/verifySignature.js.
    const sigKey = crypto.randomBytes(32).toString('hex');

    const payload = {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        permissions: permissions.map((p) => ({ module_code: p.module_code, action_code: p.action_code })),
        sigKey,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ id: user.id });

    const expiresAt = new Date(Date.now() + ms(REFRESH_EXPIRES_IN));
    await refreshTokenModel.create({ userId: user.id, tokenHash: hashToken(refreshToken), expiresAt });

    // Dọn rác refresh_tokens (revoked/expired) với xác suất thấp thay vì mỗi lần login/refresh
    // đều query thêm — đủ để bảng không phình vô hạn mà không cần thêm cron job riêng.
    if (Math.random() < 0.01) {
        refreshTokenModel.deleteExpiredAndRevoked().catch((err) => console.error('refresh_tokens cleanup failed:', err.message));
    }

    return { accessToken, refreshToken, permissions, signingKey: sigKey, user: toPublicUser(user) };
}

async function login({ username, password, ip }) {
    const user = await userModel.findByUsername(username);

    if (!user) {
        await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        await auditLogModel.create({ action: AUDIT_ACTION.LOGIN, ip, status: AUDIT_STATUS.FAILURE, detail: `Unknown username: ${username}` });
        throw new AppError(401, ERROR_CODE.INVALID_CREDENTIALS, 'Invalid username or password');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        await auditLogModel.create({ userId: user.id, action: AUDIT_ACTION.LOGIN, ip, status: AUDIT_STATUS.FAILURE, detail: 'Account locked' });
        throw new AppError(423, ERROR_CODE.ACCOUNT_LOCKED, 'Account is temporarily locked. Try again later.');
    }

    if (user.status === USER_STATUS.LOCKED) {
        await auditLogModel.create({ userId: user.id, action: AUDIT_ACTION.LOGIN, ip, status: AUDIT_STATUS.FAILURE, detail: 'Account disabled' });
        throw new AppError(403, ERROR_CODE.ACCOUNT_DISABLED, 'Account has been disabled');
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
        const attempts = user.failed_login_attempts + 1;
        const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

        await userModel.recordFailedLogin(user.id, {
            attempts: shouldLock ? 0 : attempts,
            lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        });

        await auditLogModel.create({ userId: user.id, action: AUDIT_ACTION.LOGIN, ip, status: AUDIT_STATUS.FAILURE, detail: `Bad password (attempt ${attempts})` });
        throw new AppError(401, ERROR_CODE.INVALID_CREDENTIALS, 'Invalid username or password');
    }

    await userModel.resetLoginAttempts(user.id);

    const session = await issueSession(user);
    await auditLogModel.create({ userId: user.id, action: AUDIT_ACTION.LOGIN, ip, status: AUDIT_STATUS.SUCCESS });

    return session;
}

async function refresh({ token }) {
    if (!token) {
        throw new AppError(401, ERROR_CODE.UNAUTHORIZED, 'Missing refresh token');
    }

    let decoded;
    try {
        decoded = verifyRefreshToken(token);
    } catch {
        throw new AppError(401, ERROR_CODE.TOKEN_EXPIRED, 'Refresh token invalid or expired');
    }

    const tokenHash = hashToken(token);
    const stored = await refreshTokenModel.findValid({ userId: decoded.id, tokenHash });
    if (!stored) {
        throw new AppError(401, ERROR_CODE.TOKEN_EXPIRED, 'Refresh token invalid or revoked');
    }
    await refreshTokenModel.revokeById(stored.id);

    const user = await userModel.findById(decoded.id);
    if (!user || user.status === USER_STATUS.LOCKED) {
        throw new AppError(401, ERROR_CODE.UNAUTHORIZED, 'User not found or disabled');
    }

    return issueSession(user);
}

async function logout({ token, userId, ip }) {
    if (token) {
        await refreshTokenModel.revokeByTokenHash(hashToken(token));
    }
    await auditLogModel.create({ userId, action: AUDIT_ACTION.LOGOUT, ip, status: AUDIT_STATUS.SUCCESS });
}

async function getProfile(userId) {
    const user = await userModel.findById(userId);
    if (!user) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
    }
    return toPublicUser(user);
}

async function updateProfile(userId, { email, full_name, ip }) {
    const existing = await userModel.findById(userId);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
    }

    const fields = {};
    if (email) fields.email = email;
    if (full_name) fields.full_name = full_name;

    if (Object.keys(fields).length === 0) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'No fields to update');
    }

    const diff = buildFieldDiff(existing, { email, full_name }, { email: 'email', full_name: 'full name' });

    try {
        await userModel.update(userId, fields);
        await auditLogModel.create({ userId, action: AUDIT_ACTION.PROFILE_UPDATE, ip, status: AUDIT_STATUS.SUCCESS, detail: diff });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            throw new AppError(409, ERROR_CODE.DUPLICATE, 'Email already exists');
        }
        throw err;
    }

    return getProfile(userId);
}

async function changePassword(userId, { currentPassword, newPassword, ip }) {
    const user = await userModel.findById(userId);
    if (!user) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
        await auditLogModel.create({ userId, action: AUDIT_ACTION.PASSWORD_CHANGE, ip, status: AUDIT_STATUS.FAILURE, detail: 'Current password mismatch' });
        throw new AppError(400, ERROR_CODE.INVALID_CURRENT_PASSWORD, 'Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userModel.update(userId, { password: passwordHash });
    await auditLogModel.create({ userId, action: AUDIT_ACTION.PASSWORD_CHANGE, ip, status: AUDIT_STATUS.SUCCESS });
}

// Không tiết lộ email có tồn tại hay không — controller luôn trả về cùng 1 response thành
// công bất kể user có tìm thấy hay không, tránh lộ email hợp lệ qua form quên mật khẩu.
async function requestPasswordReset({ email, ip }) {
    const user = await userModel.findByEmail(email);
    if (!user) {
        return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await passwordResetTokenModel.create({ userId: user.id, tokenHash: hashToken(token), expiresAt });

    const resetLink = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetLink);

    await auditLogModel.create({ userId: user.id, action: AUDIT_ACTION.PASSWORD_RESET_REQUEST, ip, status: AUDIT_STATUS.SUCCESS });
}

async function resetPasswordWithToken({ token, newPassword, ip }) {
    const tokenHash = hashToken(token);
    const stored = await passwordResetTokenModel.findValid({ tokenHash });
    if (!stored) {
        throw new AppError(400, ERROR_CODE.INVALID_RESET_TOKEN, 'This password reset link is invalid or has expired');
    }

    const user = await userModel.findById(stored.user_id);
    if (!user) {
        throw new AppError(400, ERROR_CODE.INVALID_RESET_TOKEN, 'This password reset link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await userModel.update(user.id, { password: passwordHash });
    await passwordResetTokenModel.markUsed(stored.id);
    // Reset xong thì mọi phiên đăng nhập cũ (kể cả của kẻ đã chiếm quyền truy cập trước đó)
    // đều phải đăng nhập lại — vô hiệu toàn bộ refresh token hiện có của user.
    await passwordResetTokenModel.invalidateAllForUser(user.id);
    await refreshTokenModel.revokeAllForUser(user.id);

    await auditLogModel.create({ userId: user.id, action: AUDIT_ACTION.PASSWORD_RESET, ip, status: AUDIT_STATUS.SUCCESS });
}

module.exports = {
    login,
    refresh,
    logout,
    getProfile,
    updateProfile,
    changePassword,
    requestPasswordReset,
    resetPasswordWithToken,
    REFRESH_COOKIE_NAME,
};
