const AppError = require('../errors/AppError');
const { ERROR_CODE } = require('#shared');
// Dùng chung với client: issue zod -> key 'validation.*' (kể cả lỗi sai kiểu mà zod tự sinh
// message tiếng Anh). shared/ là ESM, require() được nhờ require(esm) của Node.
const { zodIssueKey } = require('../../../shared/validators/issueKey');

/**
 * Validate req.body against a zod schema. Trên lỗi, throw ERR_VALIDATION với
 * params { field, reasonKey } — reasonKey là 1 key ngắn (vd 'validation.tooShort') để
 * errorHandler tra bản dịch đúng ngôn ngữ, thay vì message tiếng Anh cố định.
 */
function toValidationError(zodError) {
    const firstIssue = zodError.issues[0];
    const field = firstIssue?.path?.join('.') || '';
    const reasonKey = firstIssue ? zodIssueKey(firstIssue) : 'validation.default';
    const fallback = field ? `${field}: ${reasonKey}` : reasonKey;
    return new AppError(400, ERROR_CODE.VALIDATION, fallback, { field, reasonKey });
}

function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return next(toValidationError(result.error));
        }
        req.body = result.data;
        next();
    };
}

/**
 * Validate req.params. Khác validateBody ở chỗ KHÔNG ghi lại req.params bằng result.data:
 * Express 4 định nghĩa req.params qua getter trên prototype của request, gán trực tiếp sẽ
 * hỏng cho các middleware/route phía sau. Thay vào đó gán từng key đã parse — nhờ vậy
 * req.params.id trở thành number thật, không còn là string.
 */
function validateParams(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            return next(toValidationError(result.error));
        }
        Object.assign(req.params, result.data);
        next();
    };
}

module.exports = { validateBody, validateParams };
