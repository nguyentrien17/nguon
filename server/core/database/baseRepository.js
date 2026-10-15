const db = require('./db');

// Factory CRUD dùng chung cho mọi Model — copy 1 Model có sẵn sang bảng mới thì chỉ cần
// đổi tên bảng truyền vào đây, phần CRUD chuẩn (findById/create/update/remove) có sẵn ngay,
// chỉ cần viết thêm các hàm đặc thù (order, join, transaction...) đè lên bằng object spread.
//
// trx tuỳ chọn ở mọi hàm ghi: truyền vào khi lệnh này phải cùng thành/cùng thất bại với các
// lệnh khác (xem userService.createUser, authService.resetPasswordWithToken). Không truyền thì
// chạy trên pool như cũ.
function baseRepository(table) {
    return {
        // Truyền build(qb) để tuỳ biến (select cột, where, order...) mà vẫn không phải viết
        // lại db(table) — gọi trơn base.findAll() thì trả nguyên bảng.
        findAll: (build) => (build ? build(db(table)) : db(table)),

        findById: async (id) => {
            const row = await db(table).where({ id }).first();
            return row || null;
        },

        create: async (fields, trx) => {
            const [id] = await (trx || db)(table).insert(fields);
            return id;
        },

        update: async (id, fields, trx) => {
            if (Object.keys(fields).length === 0) return 0;
            return (trx || db)(table).where({ id }).update(fields);
        },

        remove: async (id, trx) => (trx || db)(table).where({ id }).del(),
    };
}

module.exports = baseRepository;
