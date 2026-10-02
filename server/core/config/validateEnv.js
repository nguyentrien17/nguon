const logger = require('../logger');

const REQUIRED_VARS = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

// Giá trị placeholder trong .env.example — nếu còn nguyên trong production thì secret thật
// chưa được điền (mục 7: không để secrets có giá trị mặc định không an toàn trong production).
const PLACEHOLDER_VALUES = [
    'change_this_password',
    'change_this_access_secret_in_production',
    'change_this_refresh_secret_in_production',
];

// Fail-fast lúc khởi động nếu thiếu biến môi trường bắt buộc — tránh trường hợp server
// vẫn chạy được nhưng vỡ ở request đầu tiên (ví dụ jwt.sign nhận secret undefined).
function validateEnv() {
    const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        logger.error(`Missing required environment variable(s): ${missing.join(', ')}`);
        logger.error('Xem server/.env.example để biết danh sách biến cần thiết.');
        process.exit(1);
    }

    // File này cố tình đọc process.env trực tiếp thay vì qua ./env — nó là bộ kiểm tra env
    // thô, cần phân biệt "chưa set" với "đã set giá trị mặc định" mà ./env đã điền sẵn.
    //
    // NODE_ENV không bắt buộc để chạy dev, nhưng quên set nó ở production thì cookie
    // refresh token mất cờ `secure` (xem features/auth/authController.js) — cảnh báo thay vì
    // chặn, để không đổi hành vi khởi động hiện có.
    if (!process.env.NODE_ENV) {
        logger.warn("NODE_ENV chưa được set — mặc định 'development'. Ở production PHẢI set NODE_ENV=production, nếu không cookie refresh token sẽ thiếu cờ Secure.");
    }

    if (process.env.NODE_ENV === 'production') {
        const placeholders = REQUIRED_VARS.filter((key) => PLACEHOLDER_VALUES.includes(process.env[key]));
        if (placeholders.length > 0) {
            logger.error(`Biến môi trường còn giá trị placeholder của .env.example ở production: ${placeholders.join(', ')}`);
            process.exit(1);
        }
    }
}

module.exports = validateEnv;
