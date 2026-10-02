// Schema dùng chung (shared/validators/*.js) trả message dạng key ngắn (vd 'validation.tooShort')
// thay vì câu tiếng Anh — dịch qua t() ở đây để đồng bộ với cách backend dịch lỗi validate.
export function getZodErrorMessage(parsed, t) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join('.');
    const reason = t(issue.message, { field, defaultValue: issue.message });
    return field ? `${field}: ${reason}` : reason;
}
