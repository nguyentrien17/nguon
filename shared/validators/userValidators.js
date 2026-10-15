import { z } from 'zod';
import { atLeastOneField, email, optionalText, positiveId, requiredName } from './fields.js';

export const passwordSchema = z
    .string()
    .min(8, 'validation.tooShort')
    .regex(/[A-Za-z]/, 'validation.invalidFormat')
    .regex(/[0-9]/, 'validation.invalidFormat');

export const createUserSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3, 'validation.tooShort')
        .max(100, 'validation.tooLong')
        .regex(/^[a-zA-Z0-9_.]+$/, 'validation.invalidFormat'),
    email,
    password: passwordSchema,
    full_name: requiredName,
    role_ids: z.array(positiveId).optional().default([]),
});

// PATCH /users/:id/status — 0 = khoá, 1 = hoạt động (USER_STATUS trong shared/constants.json).
export const userStatusSchema = z.object({
    status: z.union([z.literal(0), z.literal(1)], 'validation.invalidFormat'),
});

// Cập nhật: email / full_name lấy từ createUserSchema (cùng quy tắc), tất cả tuỳ chọn.
export const updateUserSchema = atLeastOneField(
    createUserSchema.pick({ email: true, full_name: true }).partial().extend({
        avatar: optionalText(500),
        password: passwordSchema.optional(),
    })
);
