// Runner migration tự viết (không dùng knex migrate API) — đọc từng file .sql trong
// database/migrations theo thứ tự tên file, ghi lại tên file đã chạy vào bảng
// schema_migrations để không chạy lại migration đã áp dụng (tránh lỗi "column already exists"
// khi migrations/ có file mới thêm vào sau này).
//
// multipleStatements chỉ mở cho kết nối riêng của script này (mỗi file .sql có thể chứa
// nhiều câu ALTER/CREATE INDEX) — không mở cho pool chính của app (server/core/database/db.js)
// để không mở rộng bề mặt SQL injection lúc runtime.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('#core/config/env');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
    const connection = await mysql.createConnection({
        host: env.db.host,
        user: env.db.user,
        password: env.db.password,
        database: env.db.name,
        multipleStatements: true,
    });

    await connection.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name VARCHAR(255) PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const [appliedRows] = await connection.query('SELECT name FROM schema_migrations');
    const applied = new Set(appliedRows.map((r) => r.name));

    const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort();

    const baseline = process.argv.includes('--baseline');

    for (const file of files) {
        if (applied.has(file)) {
            console.log(`skip (already applied): ${file}`);
            continue;
        }

        if (baseline) {
            // Chỉ ghi nhận "đã áp dụng" cho DB đang ở sẵn trạng thái này rồi (ví dụ DB được
            // dựng thẳng từ schema.sql), không thực thi lại SQL — dùng đúng 1 lần khi mới
            // thêm cơ chế tracking này vào một DB đã tồn tại từ trước.
            console.log(`baseline (marking as applied, not executing): ${file}`);
            await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
            continue;
        }

        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        console.log(`applying: ${file}`);
        await connection.query(sql);
        await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    }

    await connection.end();
    console.log('Done.');
}

run().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
