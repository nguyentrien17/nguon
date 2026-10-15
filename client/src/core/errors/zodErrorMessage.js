// Schema dùng chung (shared/validators/*.js) trả message dạng key ngắn (vd 'validation.tooShort')
// thay vì câu tiếng Anh — dịch qua t() ở đây để đồng bộ với cách backend dịch lỗi validate.

// Issue zod -> key 'validation.*': dùng chung với server (shared/validators/issueKey.js), nên
// client và server luôn báo cùng một lỗi cho cùng một dữ liệu.
import { zodIssueKey } from '@shared/validators/issueKey';

export { zodIssueKey };

// Dịch một issue; `field` là tên hiển thị (label) chèn vào {{field}}.
export function translateZodIssue(issue, t, field) {
    return t(zodIssueKey(issue), { field: field ?? issue.path.join('.') });
}

export function getZodErrorMessage(parsed, t) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join('.');
    const reason = translateZodIssue(issue, t, field);
    return field ? `${field}: ${reason}` : reason;
}
