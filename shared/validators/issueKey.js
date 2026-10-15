// Đổi một issue của zod thành key dịch 'validation.*' — dùng chung cho server
// (core/http/validate.js) và client (core/errors/zodErrorMessage.js).
//
// Schema trong shared/ đã ghi key cho các quy tắc chính, nhưng lỗi SAI KIỂU (gửi null / số thay vì
// chuỗi, thiếu trường...) do zod tự sinh message tiếng Anh. Không map thì server trả nguyên câu
// "Invalid input: expected string, received null" cho người dùng tiếng Việt.

const CODE_TO_KEY = {
    too_small: 'validation.tooShort',
    too_big: 'validation.tooLong',
    invalid_format: 'validation.invalidFormat',
    invalid_string: 'validation.invalidFormat',
};

export function zodIssueKey(issue) {
    if (typeof issue.message === 'string' && issue.message.startsWith('validation.')) return issue.message;
    if (issue.code === 'invalid_type' && /received undefined/.test(issue.message)) return 'validation.required';
    // .min(1) trên chuỗi thực chất là "bắt buộc nhập".
    if (issue.code === 'too_small' && issue.origin === 'string' && Number(issue.minimum) === 1) return 'validation.required';
    return CODE_TO_KEY[issue.code] || 'validation.default';
}
