const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Đọc qua core/config/env thay vì process.env trực tiếp — env.js tự gọi dotenv.config() nên
// file này không còn phụ thuộc vào việc ai require nó trước/sau khi dotenv chạy (trước đây
// require jwt.js từ một script độc lập sẽ nhận secret = undefined mà không báo lỗi).
const ACCESS_SECRET = env.jwt.accessSecret;
const REFRESH_SECRET = env.jwt.refreshSecret;
const ACCESS_EXPIRES_IN = env.jwt.accessExpiresIn;
const REFRESH_EXPIRES_IN = env.jwt.refreshExpiresIn;

const ALGORITHM = 'HS256';

function signAccessToken(payload) {
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN, algorithm: ALGORITHM });
}

function signRefreshToken(payload) {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN, algorithm: ALGORITHM });
}

function verifyAccessToken(token) {
    return jwt.verify(token, ACCESS_SECRET, { algorithms: [ALGORITHM] });
}

function verifyRefreshToken(token) {
    return jwt.verify(token, REFRESH_SECRET, { algorithms: [ALGORITHM] });
}

module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    REFRESH_EXPIRES_IN,
};
