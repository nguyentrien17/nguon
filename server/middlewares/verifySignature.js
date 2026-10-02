const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { ERROR_CODE } = require('#shared');

const TOLERANCE_MS = 5 * 60 * 1000;

// Xác minh chữ ký HMAC-SHA256 trên request — lớp chống giả mạo/replay cho phiên đã đăng nhập
// (không thay thế auth, xem giải thích ở plan). Ký trên "${timestamp}.${rawBody}" — không đưa
// URL/method vào để tránh lệch chuẩn hoá path giữa client/server (đánh đổi đã ghi trong plan).
// Phải chạy SAU authenticate vì cần req.user.sigKey.
//
// Threat model: sigKey nằm ngay trong payload JWT (chỉ base64, không mã hoá) nên nếu access
// token bị đánh cắp thì sigKey cũng mất theo — middleware này KHÔNG chống được kịch bản token
// bị đánh cắp/replay bởi chính bên cầm token. Giá trị thực tế là chặn một bên thứ ba không có
// access token nhưng có thể chèn/sửa request đi qua (ví dụ proxy trung gian không tin cậy, hoặc
// lỗi cấu hình khiến request bị route sai) — tức chống tamper-in-transit, không chống session
// hijacking. Không dùng middleware này như một lớp bảo mật thay thế cho TLS hay bảo vệ token.
function verifySignature(req, res, next) {
    const signature = req.get('X-Signature');
    const timestamp = req.get('X-Signature-Timestamp');

    if (!signature || !timestamp) {
        return next(new AppError(400, ERROR_CODE.SIGNATURE_MISSING, 'Missing request signature'));
    }

    const age = Date.now() - Number(timestamp);
    if (!Number.isFinite(age) || Math.abs(age) > TOLERANCE_MS) {
        return next(new AppError(400, ERROR_CODE.SIGNATURE_EXPIRED, 'Request signature expired'));
    }

    const raw = req.rawBody ? req.rawBody.toString('utf8') : '';
    const payload = `${timestamp}.${raw}`;
    const expected = crypto.createHmac('sha256', req.user.sigKey).update(payload).digest('hex');

    let provided;
    try {
        provided = Buffer.from(signature, 'hex');
    } catch {
        return next(new AppError(400, ERROR_CODE.INVALID_SIGNATURE, 'Invalid request signature'));
    }
    const expectedBuf = Buffer.from(expected, 'hex');

    if (provided.length !== expectedBuf.length || !crypto.timingSafeEqual(provided, expectedBuf)) {
        return next(new AppError(400, ERROR_CODE.INVALID_SIGNATURE, 'Invalid request signature'));
    }

    next();
}

module.exports = verifySignature;
