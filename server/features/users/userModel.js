const db = require('#core/database/db');
const baseRepository = require('#core/database/baseRepository');

const base = baseRepository('users');

async function findByUsername(username) {
    const row = await db('users').where({ username }).first();
    return row || null;
}

async function findByEmail(email) {
    const row = await db('users').where({ email }).first();
    return row || null;
}

const findById = base.findById;

// search đã được wrap sẵn dạng '%...%' bởi userService trước khi gọi vào đây.
function applySearch(qb, search) {
    if (!search) return;
    qb.where('username', 'like', search).orWhere('email', 'like', search).orWhere('full_name', 'like', search);
}

async function list({ page, limit, search }) {
    const offset = (page - 1) * limit;

    const rows = await base.findAll((q) =>
        q
            .select('id', 'username', 'email', 'full_name', 'avatar', 'status', 'created_at')
            .where((qb) => applySearch(qb, search))
            .orderBy('id', 'desc')
            .limit(limit)
            .offset(offset)
    );
    const { total } = await base.findAll((q) => q.where((qb) => applySearch(qb, search)).count({ total: '*' })).first();

    return { rows, total: Number(total) };
}

async function listAll({ search }) {
    return base.findAll((q) =>
        q
            .select('id', 'username', 'email', 'full_name', 'status', 'created_at')
            .where((qb) => applySearch(qb, search))
            .orderBy('id', 'desc')
    );
}

async function create({ username, email, passwordHash, full_name }, trx) {
    return base.create({ username, email, password: passwordHash, full_name }, trx);
}

// Chỉ các field trong danh sách này mới được phép ghi qua update() — chặn một field lạ
// (vd id, username) lọt vào câu UPDATE nếu caller truyền nhầm object.
const UPDATABLE_FIELDS = ['email', 'full_name', 'avatar', 'password', 'status', 'failed_login_attempts', 'locked_until'];

async function update(id, fields, trx) {
    const filtered = Object.fromEntries(Object.entries(fields).filter(([key]) => UPDATABLE_FIELDS.includes(key)));
    return base.update(id, filtered, trx);
}

const setStatus = (id, status, trx) => update(id, { status }, trx);
const resetLoginAttempts = (id) => update(id, { failed_login_attempts: 0, locked_until: null });

// Tăng bộ đếm ngay trong DB (failed_login_attempts = failed_login_attempts + 1) thay vì đọc
// giá trị ở tầng app rồi ghi lại: kiểu đọc-rồi-ghi để N request sai mật khẩu song song cùng
// ghi "attempts = 1" và không bao giờ chạm ngưỡng khoá. Trả về giá trị SAU khi tăng — mỗi
// request đọc sau lần tăng của chính nó, nên request làm bộ đếm chạm ngưỡng chắc chắn thấy.
async function incrementFailedLogin(id) {
    await db('users').where({ id }).increment('failed_login_attempts', 1);
    const row = await db('users').where({ id }).first('failed_login_attempts');
    return row ? Number(row.failed_login_attempts) : 0;
}

const lockLogin = (id, lockedUntil) => update(id, { failed_login_attempts: 0, locked_until: lockedUntil });

module.exports = {
    findByUsername,
    findByEmail,
    findById,
    list,
    listAll,
    create,
    update,
    setStatus,
    incrementFailedLogin,
    lockLogin,
    resetLoginAttempts,
};
