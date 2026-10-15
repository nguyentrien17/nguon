const crypto = require('crypto');
const AppError = require('../errors/AppError');
const { ERROR_CODE } = require('#shared');
// Dùng chung với client (core/api/requestSigning.js) — shared/ là ESM, require() được nhờ require(esm).
const { canonicalMultipart } = require('../../../shared/multipartSignature');

const sha256Hex = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// Chuỗi được ký của một request multipart: dựng lại từ trường text (req.body) và file (req.file /
// req.files) mà middleware upload (core/http/upload.js) đã đọc — PHẢI chạy sau middleware đó.
// Chưa đọc file thì chuỗi rỗng không khớp chữ ký của client -> từ chối (an toàn mặc định).
function multipartSignable(req) {
    const entries = [];
    for (const [name, value] of Object.entries(req.body || {})) {
        for (const v of Array.isArray(value) ? value : [value]) entries.push({ name, value: String(v) });
    }
    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : req.file ? [req.file] : [];
    for (const f of files) entries.push({ name: f.fieldname, value: { sha256: sha256Hex(f.buffer), size: f.size } });
    return canonicalMultipart(entries);
}

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

    // JSON: ký trên byte gốc của body. Multipart (upload): ký trên chuỗi chuẩn hoá có SHA-256 từng
    // file — xem shared/multipartSignature.js.
    const raw = req.is('multipart/form-data') ? multipartSignable(req) : req.rawBody ? req.rawBody.toString('utf8') : '';
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
