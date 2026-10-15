import { z } from 'zod';
import { atLeastOneField, email } from './fields.js';
import { createUserSchema, passwordSchema } from './userValidators.js';

// Đăng nhập: chỉ kiểm tra không rỗng (không giới hạn độ dài / định dạng — sai thì server trả
// "sai tên đăng nhập hoặc mật khẩu", không lộ quy tắc). Mật khẩu KHÔNG trim.
export const loginSchema = z.object({
    username: z.string().trim().min(1, 'validation.required'),
    password: z.string().min(1, 'validation.required'),
});

// Tự sửa hồ sơ: cùng quy tắc email / full_name với quản lý user.
export const updateProfileSchema = atLeastOneField(createUserSchema.pick({ email: true, full_name: true }).partial());

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'validation.required'),
    newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
    token: z.string().min(1, 'validation.required'),
    newPassword: passwordSchema,
});
