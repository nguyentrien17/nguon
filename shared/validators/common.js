const { z } = require('zod');

// Dùng cho route mutate nhưng không nhận input (archive/restore/scaffold...) — từ chối rõ
// ràng nếu client gửi kèm field lạ, thay vì âm thầm bỏ qua req.body.
const emptyBodySchema = z.object({}).strict();

module.exports = { emptyBodySchema };
