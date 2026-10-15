import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { translateZodIssue } from '@/core/errors/zodErrorMessage';
import { createUserSchema, updateUserSchema } from '@shared/validators/userValidators';
import { changePasswordSchema, updateProfileSchema } from '@shared/validators/authValidators';
import { buildInitialValues, compactValues, fileMatchesAccept, formatBytes, isRequiredBySchema, normalizeField, validateForm } from './formUtils';

// validateForm chạy với SCHEMA THẬT dùng chung với server (shared/validators).
const t = i18n.t.bind(i18n);
const run = (args) => validateForm({ t, translateIssue: (issue, label) => translateZodIssue(issue, t, label), ...args });

const userFields = (isEdit) => [
    { name: 'username', label: 'Tên đăng nhập', hidden: isEdit },
    { name: 'email', label: 'Email', required: true },
    { name: 'full_name', label: 'Họ tên', required: true },
    { name: 'password', label: 'Mật khẩu' },
    { name: 'role_ids', type: 'checkboxes', label: 'Vai trò', hidden: isEdit },
];

describe('suy luận trường', () => {
    it('chuỗi -> type suy từ tên', () => {
        expect(normalizeField('newPassword').type).toBe('password');
        expect(normalizeField('email').type).toBe('email');
        expect(normalizeField('full_name').type).toBe('text');
    });

    it('bắt buộc suy từ schema, kể cả schema sau .refine', () => {
        expect(isRequiredBySchema(createUserSchema, 'username')).toBe(true);
        expect(isRequiredBySchema(createUserSchema, 'role_ids')).toBe(false);
        expect(isRequiredBySchema(updateUserSchema, 'password')).toBe(false);
        expect(isRequiredBySchema(updateProfileSchema, 'email')).toBe(false);
    });

    it('giá trị rỗng theo type', () => {
        expect(buildInitialValues(userFields(false).map(normalizeField))).toEqual({ username: '', email: '', full_name: '', password: '', role_ids: [] });
    });

    it("compactValues XOÁ key rỗng (không chỉ gán undefined) — .refine đếm cả key undefined", () => {
        expect(compactValues({ a: '', b: undefined, c: 0, d: null, e: 'x' })).toEqual({ c: 0, d: null, e: 'x' });
    });
});

describe('validateForm', () => {
    it('form trống: báo bắt buộc ở các trường bắt buộc, dịch + chèn label', () => {
        const r = run({ fields: userFields(false), values: { username: '', email: '', full_name: '', password: '', role_ids: [] }, schema: createUserSchema });
        expect(Object.keys(r.errors).sort()).toEqual(['email', 'full_name', 'password', 'username']);
        expect(r.errors.email).toBe('Email là bắt buộc');
        expect(r.formError).toBeNull();
    });

    it('lỗi định dạng / độ dài lấy từ schema dùng chung', () => {
        const r = run({ fields: userFields(false), values: { username: 'ab', email: 'x@', full_name: 'A', password: 'short', role_ids: [] }, schema: createUserSchema });
        expect(r.errors).toMatchObject({ username: 'Tên đăng nhập quá ngắn', email: 'Email không đúng định dạng', password: 'Mật khẩu quá ngắn' });
    });

    it('hợp lệ: data đã qua schema (trim) và giữ role_ids', () => {
        const r = run({ fields: userFields(false), values: { username: ' alice ', email: 'a@b.co', full_name: 'Alice', password: 'Passw0rd!', role_ids: [3, 1] }, schema: createUserSchema });
        expect(r.errors).toEqual({});
        expect(r.data).toMatchObject({ username: 'alice', role_ids: [3, 1] });
    });

    it('sửa user: password trống không gửi, trường ẩn không có trong data', () => {
        const r = run({ fields: userFields(true), values: { username: 'alice', email: 'a@b.co', full_name: 'Alice', password: '', role_ids: [9] }, schema: updateUserSchema });
        expect(r.errors).toEqual({});
        expect(r.data).not.toHaveProperty('password');
        expect(r.data).not.toHaveProperty('username');
        expect(r.data).not.toHaveProperty('role_ids');
    });

    it('validate tuỳ chọn chỉ chạy khi schema hợp lệ, và giữ trường ngoài schema', () => {
        const fields = [{ name: 'currentPassword' }, { name: 'newPassword' }, { name: 'confirmPassword', label: 'Xác nhận', required: true }];
        const mismatch = (d) => (d.newPassword !== d.confirmPassword ? { confirmPassword: 'Không khớp' } : null);

        let r = run({ fields, values: { currentPassword: 'x', newPassword: 'Passw0rd!', confirmPassword: 'Other123' }, schema: changePasswordSchema, validate: mismatch });
        expect(r.errors).toEqual({ confirmPassword: 'Không khớp' });

        r = run({ fields, values: { currentPassword: 'x', newPassword: 'Passw0rd!', confirmPassword: 'Passw0rd!' }, schema: changePasswordSchema, validate: mismatch });
        expect(r.errors).toEqual({});
        expect(r.data.confirmPassword).toBe('Passw0rd!');

        r = run({ fields, values: { currentPassword: '', newPassword: 'a', confirmPassword: 'b' }, schema: changePasswordSchema, validate: mismatch });
        expect(r.errors.confirmPassword).toBeUndefined();
        expect(r.errors.currentPassword).toBeTruthy();
    });

    it('lỗi refine (không thuộc trường nào) -> formError', () => {
        const r = run({ fields: [{ name: 'email' }, { name: 'full_name' }], values: { email: '', full_name: '' }, schema: updateProfileSchema });
        expect(r.formError).toBe('Không có thông tin nào để cập nhật');
    });

    it('schema không ghi message (.max(255)) vẫn dịch, không lọt câu tiếng Anh của zod', () => {
        const r = run({ fields: [{ name: 'full_name', label: 'Họ tên' }], values: { full_name: 'x'.repeat(300) }, schema: updateProfileSchema });
        expect(r.errors.full_name).toBe('Họ tên quá dài');
    });
});

describe('file', () => {
    const file = (name, type, size = 1) => ({ name, type, size });
    it('accept theo đuôi, theo nhóm mime, theo mime chính xác', () => {
        expect(fileMatchesAccept(file('A.XLSX', ''), '.xlsx,.csv')).toBe(true);
        expect(fileMatchesAccept(file('a.png', 'image/png'), 'image/*')).toBe(true);
        expect(fileMatchesAccept(file('a.pdf', 'application/pdf'), 'image/*')).toBe(false);
        expect(fileMatchesAccept(file('a.pdf', 'application/pdf'), 'application/pdf')).toBe(true);
    });
    it('formatBytes', () => {
        expect([formatBytes(512), formatBytes(2048), formatBytes(5 * 1024 * 1024)]).toEqual(['512 B', '2.0 KB', '5.0 MB']);
    });
});
