const db = require('#core/database/db');
const baseRepository = require('#core/database/baseRepository');

const base = baseRepository('password_reset_tokens');

async function create({ userId, tokenHash, expiresAt }) {
    await base.create({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
}

const markUsed = (id, trx) => base.update(id, { used: 1 }, trx);

// Khoá dòng token (SELECT ... FOR UPDATE) trong transaction của caller rồi đánh dấu đã dùng —
// hai request reset song song cùng một link thì request sau phải chờ, và khi đọc lại thấy
// used = 1 nên bị từ chối. Trả về row token hoặc null.
async function consume({ tokenHash }, trx) {
    const row = await trx('password_reset_tokens')
        .where({ token_hash: tokenHash, used: 0 })
        .andWhere('expires_at', '>', db.fn.now())
        .forUpdate()
        .first();
    if (!row) return null;
    await markUsed(row.id, trx);
    return row;
}

// Vô hiệu các token reset chưa dùng khác của cùng user — 1 lần reset thành công thì
// không còn link reset cũ nào (đã gửi trước đó) còn hiệu lực nữa.
async function invalidateAllForUser(userId, trx) {
    await (trx || db)('password_reset_tokens').where({ user_id: userId, used: 0 }).update({ used: 1 });
}

async function deleteExpiredAndUsed() {
    await db('password_reset_tokens').where('used', 1).orWhere('expires_at', '<', db.fn.now()).del();
}

module.exports = { create, consume, markUsed, invalidateAllForUser, deleteExpiredAndUsed };
