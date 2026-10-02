const rateLimit = require('express-rate-limit');
const { ERROR_CODE } = require('#shared');

const loginLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 phút
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        errorCode: ERROR_CODE.TOO_MANY_ATTEMPTS,
        message: 'Too many login attempts. Please try again later.',
    },
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 phút
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        errorCode: ERROR_CODE.TOO_MANY_REQUESTS,
        message: 'Too many requests. Please slow down.',
    },
});

module.exports = { loginLimiter, apiLimiter };
