const env = require('./config/env');

// Application logging (mục 12): lỗi, cảnh báo, trạng thái hệ thống. KHÁC audit log —
// "ai làm gì lên đối tượng nào" thuộc features/audit-logs và ghi vào MySQL, không vào đây.
//
// Hiện bọc console để có mức log và tiền tố nhất quán, chưa thêm thư viện logging nào
// (mục 14: không thêm dependency khi chưa chứng minh được nhu cầu). Khi cần log có cấu trúc
// cho production, chỉ cần thay thân các hàm dưới đây — chỗ gọi không phải đổi.
//
// KHÔNG ghi mật khẩu, access/refresh token hay secret qua logger này.
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

// Production mặc định bỏ debug để không làm nhiễu log vận hành.
const threshold = LEVELS[env.LOG_LEVEL] ?? (env.isProduction ? LEVELS.info : LEVELS.debug);

function emit(level, consoleFn, args) {
    if (LEVELS[level] > threshold) return;
    consoleFn(`[${new Date().toISOString()}] ${level.toUpperCase()}`, ...args);
}

const logger = {
    error: (...args) => emit('error', console.error, args),
    warn: (...args) => emit('warn', console.warn, args),
    info: (...args) => emit('info', console.log, args),
    debug: (...args) => emit('debug', console.log, args),
};

module.exports = logger;
