import { z } from 'zod';

// "Viên gạch" trường dùng chung cho mọi schema trong shared/validators. Mỗi quy tắc định nghĩa
// ĐÚNG MỘT LẦN và luôn kèm key dịch (validation.*) — trước đây cùng một trường bị chép ở nhiều
// file, các bản sao lệch nhau (bản thiếu message làm server trả câu tiếng Anh của zod).
//
// Đổi quy tắc ở đây là đổi cho MỌI schema dùng nó (và cho cả client lẫn server).

/** Tên hiển thị bắt buộc: trim, 1–255 ký tự. */
export const requiredName = z.string().trim().min(1, 'validation.required').max(255, 'validation.tooLong');

/** Chuỗi tuỳ chọn, cho phép null (null = xoá giá trị): trim, tối đa `max` ký tự. */
export const optionalText = (max) => z.string().trim().max(max, 'validation.tooLong').optional().nullable();

/** Mã viết HOA (role, module): A-Z, 0-9, _ ; 2–100 ký tự. */
export const upperCode = z
    .string()
    .trim()
    .min(2, 'validation.tooShort')
    .max(100, 'validation.tooLong')
    .regex(/^[A-Z0-9_]+$/, 'validation.invalidFormat');

/** Mã viết thường (action): a-z, 0-9, _ ; 1–100 ký tự. */
export const lowerCode = z
    .string()
    .trim()
    .min(1, 'validation.required')
    .max(100, 'validation.tooLong')
    .regex(/^[a-z0-9_]+$/, 'validation.invalidFormat');

export const email = z.string().trim().email('validation.invalidFormat');

/** Id bản ghi (số nguyên dương). */
export const positiveId = z.number().int().positive();

/** Id tuỳ chọn, null = không có (vd không có cha). */
export const optionalId = positiveId.optional().nullable();

/** Trạng thái bản ghi: 0 ngưng, 1 hoạt động, 2 lưu trữ (RECORD_STATUS trong shared/constants.json). */
export const recordStatus = z.number().int().min(0).max(2);

/** Bọc schema "cập nhật một phần": phải gửi ít nhất một trường. */
export const atLeastOneField = (schema) =>
    schema.refine((data) => Object.keys(data).length > 0, { message: 'validation.noFieldsToUpdate' });
