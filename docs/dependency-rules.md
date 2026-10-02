# Quy tắc phụ thuộc

Mục đích: ngăn source trượt dần thành một khối rối. Đọc kèm
[architecture.md](architecture.md).

## 1. Mười quy tắc

| # | Quy tắc | Trạng thái |
|---|---|---|
| 1 | **Core không được import từ Features.** | ✅ đã tuân thủ |
| 2 | **Shared không được phụ thuộc vào Core, Features, React hay Express.** | ✅ đã tuân thủ |
| 3 | Feature được dùng Core và Shared. | ✅ |
| 4 | Hạn chế feature import trực tiếp **model** nội bộ của feature khác. | ⚠️ còn vi phạm, xem mục 4 |
| 5 | Khi cần trao đổi giữa feature, ưu tiên gọi **service** của feature kia. | ⚠️ |
| 6 | Không tạo vòng phụ thuộc. | ⚠️ không có vòng ở mức file, có ở mức feature |
| 7 | **Controller** xử lý HTTP; không chứa SQL hay nghiệp vụ phức tạp. | ✅ |
| 8 | **Service** xử lý use case; không chạm vào `req`/`res`. | ✅ |
| 9 | **Model/repository** chịu trách nhiệm truy cập dữ liệu. | ✅ |
| 10 | **Validator** kiểm tra dữ liệu đầu vào; **không** thay cho kiểm tra quyền hay quy tắc nghiệp vụ. | ✅ |

Quy tắc 10 quan trọng hơn vẻ ngoài của nó: `createUserSchema` xác nhận `role_ids` là mảng
số nguyên dương, nhưng **việc actor có được phép gán role hay không** là quyết định nghiệp
vụ và nằm ở `userService.assertCanAssignRoles`. Đừng gộp hai thứ này.

## 2. Chiều phụ thuộc cho phép

```
features/  ──→  core/  ──→  shared/
    │                          ▲
    └──────────────────────────┘
```

Mọi mũi tên ngược đều là lỗi. Cụ thể, **không** được có:

- `core/**` require `features/**` hoặc `#features/*`
- `shared/**` require `express`, `react`, `knex`, `core/**`, `features/**`
- `shared/**` require bất cứ thứ gì ngoài `zod` và chính `shared/**`

## 3. Cách kiểm tra

```bash
# Quy tắc 1 — phải in "PASS". Chỉ xét require thật, không xét chữ "features" trong comment.
grep -rnE "require\(['\"](#features/|\.\./)*features/" server/core/ && echo "VI PHAM" || echo "PASS"

# Quy tắc 2 — phải không có output nào ngoài 'zod' và đường dẫn nội bộ ./
grep -rn "require(" shared/ | grep -v "require('zod')" | grep -v "require('\./"
```

Hai lệnh này nên được thêm vào CI khi có CI. Chúng rẻ và bắt được đúng loại lỗi mà
code review hay bỏ sót.

Ngoài ra `npm run smoke` (trong `server/`) load toàn bộ import graph và kiểm tra rằng
`core/security/authenticate.js` không export `requirePermission` — tức Core không giành lại
việc phân quyền của Feature.

## 4. Vi phạm đã biết và lý do chấp nhận tạm

Quy tắc 4/5 — các service gọi thẳng model của feature khác:

| File | Import | Hướng xử lý |
|---|---|---|
| `features/auth/authService.js` | `users/userModel`, `permissions/permissionModel`, `audit-logs/auditLogModel` | Chấp nhận. Auth buộc phải đọc bảng users để xác thực; tách qua service sẽ thêm một lớp không mang lại gì. |
| `features/users/userService.js` | `permissions/permissionModel`, `audit-logs/auditLogModel` | Chấp nhận có điều kiện — xem bên dưới. |
| `features/permissions/permissionService.js` | `modules/moduleModel`, `actions/actionModel`, `users/userModel` | Chấp nhận: 3 feature này cùng tạo thành RBAC, dự định gom vào `features/rbac/`. |
| `features/actions/actionService.js` | `modules/moduleModel`, `permissions/permissionModel` | Như trên. |
| `features/modules/moduleService.js` | `actions/actionModel`, `actions/actionService` | Như trên. |

**`auditLogModel` là ngoại lệ được chấp nhận ở mọi feature.** Ghi audit log là việc
xuyên suốt (cross-cutting); mọi service đều cần. Đưa nó vào Core thì sai vì nó gắn với
bảng `audit_logs` và nghiệp vụ kiểm toán cụ thể; bắt mỗi feature đi qua `auditLogService`
chỉ để INSERT một dòng thì vô ích. Nếu sau này cần đổi cách ghi (queue, batch, file), hãy
tập trung thay đổi trong `auditLogModel.create`.

**Vòng phụ thuộc ở mức feature:** `modules ↔ actions` và `permissions ↔ users`.
Node resolve được vì các cạnh nằm ở file khác nhau, nhưng đây là nợ kỹ thuật. Đừng làm
nó tệ hơn; khi gom `features/rbac/` thì cạnh `modules ↔ actions` sẽ thành nội bộ một
feature và tự biến mất.

## 5. Hai vi phạm đã được sửa (giữ lại để tham khảo)

Trước đợt refactor, hai file hạ tầng import thẳng model của feature — đúng kiểu lỗi mà
quy tắc 1 tồn tại để ngăn:

| File cũ | Vấn đề | Đã chuyển thành |
|---|---|---|
| `middlewares/authMiddleware.js` | chứa cả `authenticate` (Core) lẫn `requirePermission` (đọc bảng `permissions`) | `core/security/authenticate.js` + `features/rbac/rbacMiddleware.js` |
| `middlewares/actionRateLimiter.js` | hạ tầng rate limit nhưng đọc cột `actions.rate_limit_per_minute` | `features/actions/actionRateLimiter.js` |

Bài học áp dụng cho code mới: **nếu một "tiện ích hạ tầng" cần biết tên một bảng cụ thể,
nó không phải hạ tầng.** Hai trường hợp khác cùng loại cũng đã được chuyển:
`utils/exportExcel.js` (biết các cột của bảng users) → `features/users/userExport.js`, và
`buildPermissionDiff` (biết `module_id`/`action_id`) → `features/rbac/`.
