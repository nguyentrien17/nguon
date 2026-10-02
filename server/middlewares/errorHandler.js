const AppError = require('../utils/AppError');
const { ERROR_CODE } = require('#shared');
const { translate } = require('../utils/errorMessages');

function buildMessage(err, locale) {
    if (err.errorCode === ERROR_CODE.VALIDATION && err.params?.reasonKey) {
        const reason = translate(err.params.reasonKey, locale, err.params) || err.params.reasonKey;
        return err.params.field ? `${err.params.field}: ${reason}` : reason;
    }
    return translate(err.errorCode, locale, err.params) || err.message;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ success: false, errorCode: err.errorCode, message: buildMessage(err, req.locale) });
    }

    console.error(`[${req.method} ${req.originalUrl}] user=${req.user?.id ?? 'anonymous'}`, err);
    const message = translate(ERROR_CODE.SERVER, req.locale) || 'Internal server error';
    return res.status(500).json({ success: false, errorCode: ERROR_CODE.SERVER, message });
}

module.exports = errorHandler;
