const db = require('#core/database/db');
const baseRepository = require('#core/database/baseRepository');

const base = baseRepository('refresh_tokens');

async function create({ userId, tokenHash, expiresAt }) {
    await base.create({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
}

// Kiểm tra-và-thu-hồi trong MỘT câu UPDATE: chỉ request nào thực sự lật revoked 0 -> 1 mới
// được dùng token. Tách thành SELECT rồi UPDATE theo id (như trước) thì hai request refresh
// song song cùng một token đều qua bước SELECT và đều nhận phiên mới. Trả true nếu dùng được.
async function consume({ userId, tokenHash }) {
    const affected = await db('refresh_tokens')
        .where({ user_id: userId, token_hash: tokenHash, revoked: 0 })
        .andWhere('expires_at', '>', db.fn.now())
        .update({ revoked: 1 });
    return affected === 1;
}

async function revokeByTokenHash(tokenHash) {
    await db('refresh_tokens').where({ token_hash: tokenHash }).update({ revoked: 1 });
}

// exceptTokenHash: giữ lại đúng phiên đang thao tác (user tự đổi mật khẩu thì không tự đá
// chính mình ra), thu hồi mọi phiên còn lại.
async function revokeAllForUser(userId, { exceptTokenHash, trx } = {}) {
    const query = (trx || db)('refresh_tokens').where({ user_id: userId, revoked: 0 });
    if (exceptTokenHash) query.whereNot({ token_hash: exceptTokenHash });
    await query.update({ revoked: 1 });
}

// Dọn các row revoked/expired — bảng này chỉ tăng (mỗi login/refresh tạo 1 row mới,
// row cũ chỉ đánh dấu revoked chứ không bao giờ xoá), gọi xác suất thấp từ authService
// thay vì cần thêm cron job riêng cho một thao tác dọn dẹp rẻ tiền như thế này.
async function deleteExpiredAndRevoked() {
    await db('refresh_tokens').where('revoked', 1).orWhere('expires_at', '<', db.fn.now()).del();
}

module.exports = { create, consume, revokeByTokenHash, revokeAllForUser, deleteExpiredAndRevoked };
