// Smoke test: load toàn bộ import graph của server mà KHÔNG mở cổng và KHÔNG kết nối DB
// (knex tạo pool lazy, chỉ connect ở query đầu tiên) — nên chạy được cả khi MySQL chưa bật.
//
// Mục đích: bắt lỗi đường dẫn require/alias sai ngay sau mỗi lô refactor di chuyển file.
// Đây là ưu tiên #1 và #2 trong mục 13 của tailieu/refactor-application-starter.md.
//
// Chạy: npm run smoke   (từ thư mục server/)
const ENTRY_POINTS = [
    // Core — hạ tầng
    '#core/config/env',
    '#core/config/validateEnv',
    '#core/logger',
    '#core/database/db',
    '#core/database/baseRepository',
    '#core/errors/AppError',
    '#core/errors/errorHandler',
    '#core/errors/errorMessages',
    '#core/http/asyncHandler',
    '#core/http/validate',
    '#core/http/locale',
    '#core/security/authenticate',
    '#core/security/jwt',
    '#core/security/verifySignature',
    '#core/security/rateLimiter',
    '#core/utils/auditDiff',
    '#core/mailer',
    // Shared
    '#shared',
    // Routes kéo theo toàn bộ 7 feature (routes → controller → service → model → validators)
    '../routes',
    // Các module không nằm trên cây require của ../routes
    '#features/actions/actionRateLimiter',
    '#features/permissions/permissionMiddleware',
    '#features/users/userExport',
];

let failed = 0;

for (const entry of ENTRY_POINTS) {
    try {
        require(entry);
        console.log(`  ok   ${entry}`);
    } catch (err) {
        failed += 1;
        console.error(`  FAIL ${entry}\n       ${err.message}`);
    }
}

// Biến môi trường bắt buộc phải validate được (ưu tiên #2 của mục 13). validateEnv() gọi
// process.exit(1) khi thiếu biến, nên nếu dòng này chạy qua được thì .env đang đủ.
try {
    require('#core/config/validateEnv')();
    console.log('  ok   validateEnv() chạy không thoát process');
} catch (err) {
    failed += 1;
    console.error(`  FAIL validateEnv(): ${err.message}`);
}

// Quy tắc phụ thuộc 1 (docs/dependency-rules.md): Core không được import Feature.
// Kiểm tra bằng grep ở CI; ở đây chỉ xác nhận hai middleware đã tách đúng chỗ.
const authenticateExports = Object.keys(require('#core/security/authenticate'));
if (authenticateExports.includes('requirePermission')) {
    failed += 1;
    console.error('  FAIL core/security/authenticate.js không được export requirePermission (thuộc feature permissions)');
} else {
    console.log('  ok   authenticate (Core) không chứa logic phân quyền (Feature)');
}

if (failed > 0) {
    console.error(`\nSMOKE FAILED: ${failed} lỗi.`);
    process.exit(1);
}
console.log('\nSMOKE OK: toàn bộ import graph load được.');
