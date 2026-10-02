const REQUIRED_VARS = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

// Fail-fast lúc khởi động nếu thiếu biến môi trường bắt buộc — tránh trường hợp server
// vẫn chạy được nhưng vỡ ở request đầu tiên (ví dụ jwt.sign nhận secret undefined).
function validateEnv() {
    const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
        process.exit(1);
    }
}

module.exports = validateEnv;
