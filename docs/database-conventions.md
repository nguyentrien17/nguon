# Quy ước database

## 1. Công cụ

- MySQL 8, engine InnoDB, collation `utf8mb4_0900_ai_ci` (đã xác nhận trên DB thật cho cả
  10 bảng — lấy theo default của server, `schema.sql` không khai `ENGINE`/`CHARSET` tường minh).
- Truy vấn qua **knex làm query builder**, không dùng ORM, không dùng knex migrate API.
- Migration là file `.sql` thuần, chạy bằng runner tự viết `server/database/migrate.js`.

## 2. Dựng database lần đầu

```bash
mysql -u root -p < server/database/schema.sql
mysql -u root -p rbac_portal < server/database/seed.sql
cd server && npm run migrate -- --baseline   # đánh dấu migration đã có là "đã áp dụng"
```

`--baseline` chỉ ghi nhận tên file vào `schema_migrations` mà **không thực thi SQL** — dùng
đúng một lần, cho DB vừa dựng từ `schema.sql` (vì `schema.sql` đã chứa sẵn kết quả của mọi
migration). Chạy `npm run migrate` không có cờ này trên DB mới sẽ lỗi "duplicate column".

## 3. Quy ước migration

- Tên file: `NNN_mô_tả_ngắn.sql`, `NNN` là số thứ tự 3 chữ số tăng dần. Runner `sort()` theo
  tên file nên thứ tự chữ số quyết định thứ tự chạy.
- **Không sửa migration đã chạy** ở môi trường dùng chung. Tạo file mới.
- Mỗi migration phải **idempotent trong phạm vi có thể**: dùng
  `WHERE NOT EXISTS (SELECT 1 ...)` cho INSERT, `IF NOT EXISTS` cho CREATE. Runner đã chống
  chạy lại qua bảng `schema_migrations`, nhưng một file idempotent vẫn an toàn hơn khi có người
  chạy tay bằng `mysql CLI`.
- Một file có thể chứa nhiều câu lệnh: connection của `migrate.js` bật `multipleStatements`.
  **Pool chính của app (`core/database/db.js`) không bật** — cố ý, để không mở rộng bề mặt
  SQL injection lúc runtime.
- `migrate.js` **không chạy trong transaction**. MySQL không rollback được DDL, nên một file
  lỗi giữa đường sẽ để DB ở trạng thái nửa vời. Viết migration sao cho chạy lại được, hoặc
  chia nhỏ thành nhiều file.

## 4. Quy ước đặt tên

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Bảng | snake_case, số nhiều | `users`, `permission_details` |
| Cột | snake_case | `full_name`, `failed_login_attempts` |
| Cột có tiền tố | bảng gốc có tiền tố tên bảng | `module_code`, `permission_name` |
| Khoá ngoại | `<bảng_số_ít>_id` | `user_id`, `module_parent_id` |
| Khoá chính | luôn là `id INT AUTO_INCREMENT` | |
| Thời gian | `created_at`, `updated_at`, kiểu `DATETIME(3)` | |
| Unique key | `uk_<mô_tả>` | `uk_module_action` |
| Index | `idx_<mô_tả>` | `idx_audit_created_at` |
| Constraint FK | `fk_<mô_tả>` | `fk_action_module` |

`DATETIME(3)` (millisecond) được dùng thống nhất, và `dateStrings: false` trong cấu hình knex
nên driver trả về `Date` của JS, không phải string.

## 5. Mô hình RBAC

```
users ──< user_permissions >── permissions          (user được gán role nào)
                                    │
                                    └──< permission_details >── modules
                                                   │
                                                   └────────── actions ──> modules
```

- `permissions` **là bảng roles** (tên bảng gây nhầm — một dòng là một vai trò như `ROLE_ADMIN`).
- `permission_details` là bảng cốt lõi: một dòng = "role X được làm action Y trên module Z".
- `actions.module_id` nghĩa là **action thuộc về đúng một module**; unique theo
  `(module_id, action_code)` chứ không phải `action_code` toàn cục (migration 002 đã chuyển sang
  mô hình này).
- Phân cấp: `permissions.permission_parent_id` và `modules.module_parent_id` tự tham chiếu,
  `ON DELETE CASCADE` — **xoá một role cha sẽ xoá sạch cây role con**. Biết trước điều này.
- `audit_logs.user_id` dùng `ON DELETE SET NULL` (không CASCADE) — xoá user không được làm mất
  dấu vết kiểm toán.

## 6. Vấn đề đã biết trong schema

Rà soát theo mục 8 của kế hoạch refactor. **Chưa cái nào được sửa** — xem mục 7.

### 6.1. `permission_details` thiếu UNIQUE → đã có dữ liệu trùng trên DB thật

`(permission_id, module_id, action_id)` chỉ có `INDEX idx_perm_module_action` **không unique**.
Hệ quả thật, đo được trên DB hiện tại:

```sql
SELECT permission_id, module_id, action_id, COUNT(*) c
FROM permission_details GROUP BY 1,2,3 HAVING c > 1;
-- → 15 tổ hợp đang bị lặp đúng 2 lần (toàn bộ thuộc permission_id = 1, tức ROLE_ADMIN)
```

Nguyên nhân có khả năng cao nhất: các migration `001` và `002` đều `INSERT` quyền cho
`ROLE_ADMIN` với điều kiện `NOT EXISTS` so trên `(permission_id, module_id, action_id)`, nhưng
nếu một file từng được chạy tay bằng `mysql CLI` **trước khi** bảng `schema_migrations` tồn tại
thì nó chạy lại một lần nữa mà `NOT EXISTS` ở lần chạy sau không chặn được (điều kiện so với
trạng thái *trước* INSERT trong cùng câu lệnh).

Tác hại hiện tại: **không sai chức năng** — `permissionModel.getUserAccess` chỉ cần biết có hay
không có quyền, nên dòng lặp không đổi kết quả phân quyền. Nhưng nó làm số liệu đếm quyền sai,
làm `buildPermissionDiff` sinh audit log nhiễu, và làm bảng phình vô ích.

### 6.2. Không có ràng buộc "action phải thuộc module đó"

`permission_details` lưu `module_id` và `action_id` **tách rời**, trong khi `actions.module_id`
đã xác định module. Không gì ngăn chèn một dòng mà `action_id` thuộc module khác
`permission_details.module_id`.

Hiện tại DB **sạch** (đã kiểm tra, 0 dòng lệch):

```sql
SELECT pd.id FROM permission_details pd
JOIN actions a ON a.id = pd.action_id WHERE a.module_id <> pd.module_id;
-- → 0 dòng
```

Nhưng đây là tính đúng đắn đang dựa vào application code chứ không vào DB. MySQL không có
CHECK constraint tham chiếu bảng khác, nên cách sửa đúng là **bỏ hẳn cột `module_id`** khỏi
`permission_details` và lấy module qua `JOIN actions`. Đó là thay đổi lớn, ảnh hưởng
`permissionModel`, `permissionService`, `insightsService` — cần đợt riêng.

### 6.3. Index trùng trên `users`

`username` và `email` khai `UNIQUE`, mà MySQL tự tạo index cho UNIQUE. Hai dòng
`INDEX idx_username (username)` / `INDEX idx_email (email)` trong `schema.sql` là **thừa hoàn
toàn**. Đã xác nhận trên DB thật: `SHOW INDEX FROM users` trả về cả `username` (Non_unique=0)
lẫn `idx_username` (Non_unique=1) trên cùng một cột.

Tác hại: mỗi INSERT/UPDATE phải cập nhật thêm 2 cây B-tree vô ích, và tốn dung lượng.

### 6.4. `schema.sql` không khai `ENGINE`/`CHARSET`

Hiện chạy đúng vì MySQL 8 default là InnoDB + utf8mb4, nhưng dựng DB trên server có default
khác (MySQL 5.7, hoặc MariaDB) sẽ ra collation khác và so sánh chuỗi khác đi.

## 7. Migration đề xuất — CHƯA ÁP DỤNG

`server/database/migrations/**pending**/011_permission_details_unique.sql` đã được viết nhưng
**cố ý chưa chạy**. Nó xử lý 6.1 và 6.3.

**Vì sao nằm trong `migrations/pending/` chứ không trong `migrations/`:** runner đọc thư mục
không đệ quy (`readdirSync` + lọc `.sql`), nên file trong `pending/` sẽ **không** bị
`npm run migrate` chạy. Đây là cố ý — để một migration có `DELETE` nằm trong đường chạy tự động
là đã "lên đạn" nó cho lần migrate tới. Mục 8 của kế hoạch refactor ghi rõ "Không tự ý chạy
migration phá hủy dữ liệu trên database thật".

Thư mục `pending/` là nơi đặt mọi migration cần người duyệt trước. Khi đã quyết định chạy,
chuyển file ra thư mục `migrations/` rồi mới `npm run migrate`.

**Tác động nếu chạy:**

- Xoá 15 dòng `permission_details` trùng lặp, giữ lại dòng có `id` nhỏ nhất mỗi tổ hợp.
  Quyền thực tế của mọi user **không đổi** (xem 6.1).
- Thêm `uk_permission_detail` → từ nay mọi INSERT trùng sẽ ném `ER_DUP_ENTRY`.
  **Cần kiểm tra trước:** `permissionService.updatePermission` xoá hết `permission_details`
  rồi chèn lại trong một transaction; nếu danh sách đầu vào có tổ hợp lặp, nó sẽ bắt đầu lỗi
  409 thay vì âm thầm chèn 2 dòng. Đây là hành vi *đúng hơn*, nhưng là thay đổi hành vi.
- Bỏ `idx_username`, `idx_email`. Không ảnh hưởng truy vấn — index UNIQUE cùng cột vẫn còn.

**Chạy khi bạn đã quyết:**

```bash
mysqldump -u root -p rbac_portal > backup_truoc_011.sql          # sao lưu trước
mv server/database/migrations/pending/011_*.sql server/database/migrations/
cd server && npm run migrate
```

6.2 và 6.4 **không có** migration kèm theo: 6.2 cần đổi cả application code, 6.4 cần đổi
`schema.sql` và chỉ ảnh hưởng DB dựng mới.

## 8. Khi thêm bảng mới

1. Thêm `CREATE TABLE` vào `schema.sql` (cho DB dựng mới) **và** một file migration mới
   (cho DB đang chạy). Hai nơi phải khớp nhau.
2. Tạo model bằng `baseRepository('tên_bảng')`, chỉ viết thêm hàm đặc thù:
   ```js
   const base = baseRepository('invoices');
   const findById = base.findById;
   ```
3. Nếu model có nhiều bước ghi phải cùng thành/cùng thất bại, dùng `db.transaction` —
   xem `permissionModel.updatePermission` và `moduleModel` làm mẫu.
4. Liệt kê cột được phép UPDATE bằng một whitelist, như `UPDATABLE_FIELDS` trong `userModel.js`
   — đây là lớp chặn mass-assignment, đừng bỏ.
