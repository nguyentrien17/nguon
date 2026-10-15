// Điểm duy nhất đọc process.env (mục 7 của tailieu/refactor-application-starter.md).
// Mọi module khác import từ đây thay vì chạm vào process.env trực tiếp — nhờ vậy:
//   - nhìn một file là biết ứng dụng cần những biến nào;
//   - không có module nào đọc được env trước khi dotenv.config() chạy (lỗi âm thầm kiểu
//     JWT secret = undefined mà server vẫn khởi động bình thường);
//   - giá trị mặc định nằm cùng một chỗ, không rải rác trong code.
//
// KHÔNG đổi tên biến môi trường hiện có — tên ở đây phải khớp .env.example và tài liệu.
require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

// Mặc định KHÔNG tin proxy: tin nhầm thì client tự gửi X-Forwarded-For giả để vượt rate limit
// và ghi IP giả vào audit log. Chạy sau nginx/Cloudflare... thì đặt TRUST_PROXY=true (tin 1
// proxy gần nhất) hoặc một số nguyên = số proxy phía trước.
function parseTrustProxy(value) {
    if (value === undefined || value === '' || value === 'false') return false;
    if (value === 'true') return 1;
    const hops = Number(value);
    return Number.isInteger(hops) && hops >= 0 ? hops : false;
}

const env = {
    NODE_ENV,
    isProduction: NODE_ENV === 'production',

    PORT: process.env.PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
    // Số lần /auth/login (và forgot/reset password) tối đa mỗi phút mỗi IP.
    LOGIN_RATE_LIMIT_MAX: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 5,

    db: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        name: process.env.DB_NAME,
    },

    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
};

module.exports = env;
