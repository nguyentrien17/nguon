const AppError = require('../utils/AppError');
const { ERROR_CODE } = require('#shared');

/**
 * Validate req.body against a zod schema. Trên lỗi, throw ERR_VALIDATION với
 * params { field, reasonKey } — reasonKey là 1 key ngắn (vd 'validation.tooShort') để
 * errorHandler tra bản dịch đúng ngôn ngữ, thay vì message tiếng Anh cố định.
 */
function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const firstIssue = result.error.issues[0];
            const field = firstIssue?.path?.join('.') || '';
            const reasonKey = firstIssue?.message || 'validation.default';
            const fallback = field ? `${field}: ${reasonKey}` : reasonKey;
            return next(new AppError(400, ERROR_CODE.VALIDATION, fallback, { field, reasonKey }));
        }
        req.body = result.data;
        next();
    };
}

module.exports = { validateBody };
