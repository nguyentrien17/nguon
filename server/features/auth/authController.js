const ms = require('ms');
const authService = require('./authService');
const asyncHandler = require('#core/http/asyncHandler');
const { REFRESH_EXPIRES_IN } = require('#core/security/jwt');
const env = require('#core/config/env');

const REFRESH_COOKIE_NAME = authService.REFRESH_COOKIE_NAME;

function setRefreshCookie(res, refreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: 'strict',
        maxAge: ms(REFRESH_EXPIRES_IN),
        path: '/api/auth',
    });
}

const login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    const session = await authService.login({ username, password, ip: req.ip });
    setRefreshCookie(res, session.refreshToken);

    return res.json({
        success: true,
        accessToken: session.accessToken,
        signingKey: session.signingKey,
        user: session.user,
        permissions: session.permissions,
    });
});

const refresh = asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    const session = await authService.refresh({ token });
    setRefreshCookie(res, session.refreshToken);

    return res.json({
        success: true,
        accessToken: session.accessToken,
        signingKey: session.signingKey,
        user: session.user,
        permissions: session.permissions,
    });
});

const logout = asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    await authService.logout({ token, userId: req.user?.id, ip: req.ip });

    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    return res.json({ success: true });
});

const me = asyncHandler(async (req, res) => {
    const data = await authService.getProfile(req.user.id);
    return res.json({ success: true, data });
});

const updateMe = asyncHandler(async (req, res) => {
    const { email, full_name } = req.body;
    const data = await authService.updateProfile(req.user.id, { email, full_name, ip: req.ip });
    return res.json({ success: true, data });
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user.id, { currentPassword, newPassword, ip: req.ip });
    return res.json({ success: true });
});

// Luôn trả về cùng 1 response thành công bất kể email có tồn tại hay không, để không lộ
// email nào đã đăng ký trong hệ thống qua form quên mật khẩu (username/email enumeration).
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    await authService.requestPasswordReset({ email, ip: req.ip });
    return res.json({ success: true });
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    await authService.resetPasswordWithToken({ token, newPassword, ip: req.ip });
    return res.json({ success: true });
});

module.exports = { login, refresh, logout, me, updateMe, changePassword, forgotPassword, resetPassword };
