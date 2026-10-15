import { z } from 'zod';

// Dùng cho route mutate nhưng không nhận input (archive/restore/scaffold...) — từ chối rõ
// ràng nếu client gửi kèm field lạ, thay vì âm thầm bỏ qua req.body.
export const emptyBodySchema = z.object({}).strict();

// Dùng cho mọi route có :id. Không có schema này thì PUT /users/1abc đi thẳng xuống
// `where({ id: '1abc' })`, MySQL coerce thành 1 và SỬA ĐÚNG user id 1 — xem docs/security.md 9.4.
// z.coerce vì param trong URL luôn là string.
export const idParamSchema = z.object({
    id: z.coerce.number('validation.invalidFormat').int('validation.invalidFormat').positive('validation.invalidFormat'),
});
