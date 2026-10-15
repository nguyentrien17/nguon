const multer = require('multer');
const AppError = require('../errors/AppError');
const { ERROR_CODE } = require('#shared');

// Nhận diện loại file bằng MAGIC BYTES (vài byte đầu file), không tin Content-Type / đuôi file do
// client gửi — đổi tên "virus.exe" thành "anh.png" không qua được.
const FILE_TYPES = {
    png: { mime: 'image/png', test: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    jpeg: { mime: 'image/jpeg', test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    webp: { mime: 'image/webp', test: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
    pdf: { mime: 'application/pdf', test: (b) => b.length >= 5 && b.toString('ascii', 0, 5) === '%PDF-' },
};

/** { ext, mime } theo nội dung thật của file, hoặc null nếu không thuộc loại nào đã biết. */
function sniffFileType(buffer) {
    for (const [ext, { mime, test }] of Object.entries(FILE_TYPES)) {
        if (test(buffer)) return { ext, mime };
    }
    return null;
}

const validationError = (status, field, reasonKey, message) => new AppError(status, ERROR_CODE.VALIDATION, message, { field, reasonKey });

/**
 * Middleware nhận ĐÚNG MỘT file ở trường `field` (multipart/form-data), giữ trong bộ nhớ
 * (req.file.buffer) — controller tự quyết định lưu ở đâu sau khi đã xác minh chữ ký.
 *
 *   router.post('/me/avatar', authenticate, singleFileUpload({ field: 'avatar', maxSize: 2 * MB,
 *               allowedTypes: ['png', 'jpeg', 'webp'] }), verifySignature, uploadAvatar);
 *
 * - Đặt TRƯỚC verifySignature: chữ ký multipart được tính trên nội dung file (SHA-256), nên phải
 *   đọc file xong mới kiểm được.
 * - Vượt maxSize -> 413; thiếu file / sai loại -> 400 ERR_VALIDATION (message đã dịch).
 * - req.file.detectedType = { ext, mime } theo magic bytes — dùng ext này khi lưu file.
 */
function singleFileUpload({ field, maxSize, allowedTypes }) {
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxSize, files: 1, fields: 20, fieldSize: 10 * 1024 },
    }).single(field);

    return (req, res, next) => {
        upload(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') return next(validationError(413, field, 'validation.fileTooLarge', 'File too large'));
                return next(validationError(400, err.field || field, 'validation.default', err.message));
            }
            if (err) return next(err);
            if (!req.file) return next(validationError(400, field, 'validation.required', 'File is required'));

            const type = sniffFileType(req.file.buffer);
            if (!type || !allowedTypes.includes(type.ext)) {
                return next(validationError(400, field, 'validation.fileType', 'File type not allowed'));
            }
            req.file.detectedType = type;
            next();
        });
    };
}

module.exports = { singleFileUpload, sniffFileType, MB: 1024 * 1024 };
