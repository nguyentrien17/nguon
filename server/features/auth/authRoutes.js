const express = require('express');
const router = express.Router();
const { login, refresh, logout, me, updateMe, uploadAvatar, removeAvatar, changePassword, forgotPassword, resetPassword } = require('./authController');
const { singleFileUpload, MB } = require('#core/http/upload');
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
// Ảnh đại diện (multipart, trường 'avatar'). Upload ĐỌC FILE TRƯỚC rồi mới verifySignature: chữ ký
// multipart tính trên SHA-256 của file (shared/multipartSignature.js).
router.post(
    '/me/avatar',
    authenticate,
    singleFileUpload({ field: 'avatar', maxSize: 2 * MB, allowedTypes: ['png', 'jpeg', 'webp'] }),
    verifySignature,
    uploadAvatar
);
router.delete('/me/avatar', authenticate, verifySignature, removeAvatar);
// Chưa đăng nhập nên không có sigKey để ký request — dùng loginLimiter để chống spam/dò email
// thay cho verifySignature (giống /login).
router.post('/forgot-password', loginLimiter, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', loginLimiter, validateBody(resetPasswordSchema), resetPassword);

module.exports = router;
