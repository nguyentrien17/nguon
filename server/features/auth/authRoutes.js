const express = require('express');
const router = express.Router();
const { login, refresh, logout, me, updateMe, changePassword, forgotPassword, resetPassword } = require('./authController');
const { loginLimiter } = require('#core/security/rateLimiter');
const { authenticate } = require('#core/security/authenticate');
const { validateBody } = require('#core/http/validate');
const verifySignature = require('#core/security/verifySignature');
const { loginSchema, updateProfileSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } = require('./authValidators');

router.post('/login', loginLimiter, validateBody(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.put('/me', authenticate, verifySignature, validateBody(updateProfileSchema), updateMe);
router.put('/password', authenticate, verifySignature, validateBody(changePasswordSchema), changePassword);
// Chưa đăng nhập nên không có sigKey để ký request — dùng loginLimiter để chống spam/dò email
// thay cho verifySignature (giống /login).
router.post('/forgot-password', loginLimiter, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', loginLimiter, validateBody(resetPasswordSchema), resetPassword);

module.exports = router;
