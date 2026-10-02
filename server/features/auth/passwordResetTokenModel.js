const db = require('#core/database/db');
const baseRepository = require('#core/database/baseRepository');

const base = baseRepository('password_reset_tokens');

async function create({ userId, tokenHash, expiresAt }) {
    await base.create({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
}

async function findValid({ tokenHash }) {
    const row = await db('password_reset_tokens')
        .where({ token_hash: tokenHash, used: 0 })
        .andWhere('expires_at', '>', db.fn.now())
        .first();
    return row || null;
}

const markUsed = (id) => base.update(id, { used: 1 });

// Vô hiệu các token reset chưa dùng khác của cùng user — 1 lần reset thành công thì
// không còn link reset cũ nào (đã gửi trước đó) còn hiệu lực nữa.
async function invalidateAllForUser(userId) {
    await db('password_reset_tokens').where({ user_id: userId, used: 0 }).update({ used: 1 });
}

async function deleteExpiredAndUsed() {
    await db('password_reset_tokens').where('used', 1).orWhere('expires_at', '<', db.fn.now()).del();
}

module.exports = { create, findValid, markUsed, invalidateAllForUser, deleteExpiredAndUsed };
