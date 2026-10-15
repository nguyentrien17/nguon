const AppError = require('./AppError');
const { ERROR_CODE } = require('#shared');
const { translate } = require('./errorMessages');
const logger = require('../logger');

function buildMessage(err, locale) {
    if (err.errorCode === ERROR_CODE.VALIDATION && err.params?.reasonKey) {
        const reason = translate(err.params.reasonKey, locale, err.params) || err.params.reasonKey;
        return err.params.field ? `${err.params.field}: ${reason}` : reason;
    }
    return translate(err.errorCode, locale, err.params) || err.message;
}

// Lỗi do client gửi sai (JSON hỏng, body quá lớn...) mà express.json() ném ra. Chúng mang
// err.type + err.status của body-parser; không bắt riêng thì rơi xuống nhánh 500 và còn bị
// log như lỗi server.
const BODY_PARSER_ERRORS = {
    'entity.parse.failed': 400,
    'entity.too.large': 413,
    'encoding.unsupported': 415,
    'charset.unsupported': 415,
    'request.aborted': 400,
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ success: false, errorCode: err.errorCode, message: buildMessage(err, req.locale) });
    }

    const bodyStatus = BODY_PARSER_ERRORS[err.type];
    if (bodyStatus) {
        const message = translate(ERROR_CODE.VALIDATION, req.locale) || 'Invalid request body';
        return res.status(bodyStatus).json({ success: false, errorCode: ERROR_CODE.VALIDATION, message });
    }

    // Ngữ cảnh đủ để truy vết (method, url, user) nhưng không log body/header — tránh ghi
    // mật khẩu hay token vào application log (mục 9 và 12).
    logger.error(`[${req.method} ${req.originalUrl}] user=${req.user?.id ?? 'anonymous'}`, err);
    const message = translate(ERROR_CODE.SERVER, req.locale) || 'Internal server error';
    return res.status(500).json({ success: false, errorCode: ERROR_CODE.SERVER, message });
}

module.exports = errorHandler;
