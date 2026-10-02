const db = require('../config/database');

// Factory CRUD dùng chung cho mọi Model — copy 1 Model có sẵn sang bảng mới thì chỉ cần
// đổi tên bảng truyền vào đây, phần CRUD chuẩn (findById/create/update/remove) có sẵn ngay,
// chỉ cần viết thêm các hàm đặc thù (order, join, transaction...) đè lên bằng object spread.
function baseRepository(table) {
    return {
        // Truyền build(qb) để tuỳ biến (select cột, where, order...) mà vẫn không phải viết
        // lại db(table) — gọi trơn base.findAll() thì trả nguyên bảng.
        findAll: (build) => (build ? build(db(table)) : db(table)),

        findById: async (id) => {
            const row = await db(table).where({ id }).first();
            return row || null;
        },

        create: async (fields) => {
            const [id] = await db(table).insert(fields);
            return id;
        },

        update: async (id, fields) => {
            if (Object.keys(fields).length === 0) return 0;
            return db(table).where({ id }).update(fields);
        },

        remove: async (id) => db(table).where({ id }).del(),
    };
}

module.exports = baseRepository;
