const db = require('#core/database/db');
const baseRepository = require('#core/database/baseRepository');

const base = baseRepository('refresh_tokens');

async function create({ userId, tokenHash, expiresAt }) {
    await base.create({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
}

async function findValid({ userId, tokenHash }) {
    const row = await db('refresh_tokens')
        .where({ user_id: userId, token_hash: tokenHash, revoked: 0 })
        .andWhere('expires_at', '>', db.fn.now())
        .first();
    return row || null;
}

const revokeById = (id) => base.update(id, { revoked: 1 });

async function revokeByTokenHash(tokenHash) {
    await db('refresh_tokens').where({ token_hash: tokenHash }).update({ revoked: 1 });
}

async function revokeAllForUser(userId) {
    await db('refresh_tokens').where({ user_id: userId, revoked: 0 }).update({ revoked: 1 });
}

// Dọn các row revoked/expired — bảng này chỉ tăng (mỗi login/refresh tạo 1 row mới,
// row cũ chỉ đánh dấu revoked chứ không bao giờ xoá), gọi xác suất thấp từ authService
// thay vì cần thêm cron job riêng cho một thao tác dọn dẹp rẻ tiền như thế này.
async function deleteExpiredAndRevoked() {
    await db('refresh_tokens').where('revoked', 1).orWhere('expires_at', '<', db.fn.now()).del();
}

module.exports = { create, findValid, revokeById, revokeByTokenHash, revokeAllForUser, deleteExpiredAndRevoked };
