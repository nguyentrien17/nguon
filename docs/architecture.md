# Kiến trúc

Tài liệu này mô tả kiến trúc **thực tế** của source, không phải kiến trúc mong muốn.
Nếu bạn sửa code mà làm tài liệu này sai, hãy sửa tài liệu trong cùng commit.

## 1. Source này là gì

Một **application starter**: nền tảng backend/frontend dùng lại được cho nhiều dự án,
kèm theo một ứng dụng mẫu hoàn chỉnh là **RBAC Portal** (quản lý người dùng, vai trò,
module, action, audit log).

Khi dùng source này cho dự án mới:

- `server/core/`, `client/src/core/` và `client/src/app/` là phần **giữ lại**.
- `server/features/` và `client/src/features/` là phần **thay bằng nghiệp vụ của bạn**.
- `features/auth` và `features/rbac` (permissions + modules + actions) nên giữ nếu dự án
  cần phân quyền; chúng được viết như module mẫu có thể thay thế.

## 2. Stack

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19, Vite 8, react-router-dom 7, axios, i18next (vi/en/zh) |
| Backend | Node.js 22 (yêu cầu tối thiểu 18), Express 4, knex 3 (query builder, **không** dùng knex migrate) |
| Database | MySQL 8 |
| Validation | Zod 4, schema dùng chung client ↔ server qua `shared/validators` |
| Auth | JWT access token (15m, header `Authorization`) + refresh token (7d, HttpOnly cookie) |

Không dùng TypeScript. Không dùng ORM. Không có Docker/CI ở thời điểm này.

## 3. Ba vùng trách nhiệm

```
┌───────────────────────────────────────────────┐
│  shared/          dùng chung client ↔ server  │
│  constants, zod schema, error code            │
│  → không biết gì về Express, React, DB        │
└───────────────────────────────────────────────┘
          ▲                          ▲
          │                          │
┌─────────┴──────────┐    ┌──────────┴─────────┐
│  server/core/      │    │  client/src/core/  │
│  hạ tầng kỹ thuật  │    │  hạ tầng FE        │
│  → không biết gì   │    │                    │
│    về nghiệp vụ    │    │                    │
└─────────┬──────────┘    └──────────┬─────────┘
          │                          │
┌─────────┴──────────┐    ┌──────────┴──────────┐
│  server/features/  │    │ client/src/features/│
│  nghiệp vụ         │    │ nghiệp vụ           │
└────────────────────┘    └─────────────────────┘
```

Quy tắc phụ thuộc đầy đủ: xem [dependency-rules.md](dependency-rules.md).

### Core là gì

Hạ tầng kỹ thuật **không chứa tên bảng, tên module hay quy tắc nghiệp vụ cụ thể**:
đọc/kiểm tra biến môi trường, kết nối DB và connection pool, logger, lớp lỗi và error
handler tập trung, middleware HTTP dùng chung, JWT, hashing, chữ ký request, rate limit,
quy ước phản hồi API.

Phép thử: *"Copy file này sang một dự án quản lý kho hàng, nó còn dùng được không?"*
Nếu không → nó thuộc Feature.

### Feature là gì

Một nghiệp vụ có thể bật/tắt/thay thế độc lập tương đối. Mỗi feature là một thư mục
với bộ file theo khuôn:

```
features/<tên>/
├── <tên>Routes.js       mount endpoint + gắn middleware (auth, permission, validate, signature)
├── <tên>Controller.js   đọc req → gọi service → trả res. Không có SQL, không có nghiệp vụ.
├── <tên>Service.js      use case: kiểm tra nghiệp vụ, điều phối model, ghi audit log.
│                        Không chạm vào req/res.
├── <tên>Model.js        truy cập dữ liệu (knex). Không chứa quy tắc nghiệp vụ.
└── <tên>Validators.js   re-export schema từ shared/validators
```

Khuôn này được tuân thủ ở cả 7 feature hiện có. Giữ nó khi thêm feature mới.

### Shared là gì

Chỉ những gì **cả client và server đều cần**, và trung lập với môi trường chạy:
`shared/constants.json`, `shared/errorMessages.json` (bảng dịch lỗi vi/en/zh),
`shared/validators/*.js` (zod).

Shared chỉ được phụ thuộc vào `zod` và chính nó.

## 4. Các feature hiện có

| Feature | Trách nhiệm | Endpoint gốc |
|---|---|---|
| `auth` | login, refresh, logout, profile, đổi mật khẩu, quên/đặt lại mật khẩu | `/api/auth` |
| `users` | CRUD người dùng, khoá/mở khoá, export Excel | `/api/users` |
| `permissions` | roles (bảng `permissions`) + gán role cho user | `/api/permissions` |
| `modules` | module/menu của hệ thống | `/api/modules` |
| `actions` | action thuộc module + cấu hình rate limit theo action | `/api/actions` |
| `audit-logs` | truy vấn lịch sử hoạt động | `/api/audit-logs` |
| `insights` | số liệu tổng quan cho dashboard | `/api/insights` |

`permissions` + `modules` + `actions` hợp thành RBAC. Chúng **chưa** được gom vào thư mục
`features/rbac/`; xem [folder-structure.md](folder-structure.md) mục "Việc còn tồn đọng".

## 5. Luồng một request

```
HTTP request
  └─ helmet, cors, express.json (giữ rawBody cho chữ ký), cookieParser, locale
      └─ apiLimiter            (300 req/phút/IP)
          └─ authenticate      core/security — verify access token, gán req.user
              └─ requirePermission(module, action)
                 │             features/rbac — đọc quyền LIVE từ DB, không tin token
              └─ verifySignature  core/security — HMAC trên "timestamp.rawBody"
              └─ validateBody(schema)  core/http — zod, lỗi → ERR_VALIDATION
                  └─ controller → service → model → MySQL
                                     └─ auditLogModel.create(...)
  └─ 404 handler
  └─ errorHandler              core/errors — điểm duy nhất biến lỗi thành response
```

Hai điểm đáng lưu ý về thiết kế:

1. **Quyền được đọc lại từ DB ở mỗi request**, không lấy từ payload JWT. Nhờ vậy thu hồi
   quyền có hiệu lực ngay ở request kế tiếp thay vì phải chờ access token hết hạn.
   Token vẫn chứa danh sách quyền, nhưng chỉ để client dựng UI.
2. **Chữ ký request** (`verifySignature`) chống sửa đổi request trên đường truyền, **không**
   chống token bị đánh cắp — `sigKey` nằm trong payload JWT nên mất token là mất luôn sigKey.
   Giới hạn này được ghi rõ trong comment đầu file; đừng coi nó là lớp bảo mật thay thế TLS.

## 6. Xác thực và phân quyền

- **Authentication** (bạn là ai) — `core/security/authenticate.js`. Thuần kỹ thuật: verify JWT.
- **Authorization** (bạn được làm gì) — `features/rbac/rbacMiddleware.js`. Phụ thuộc vào bảng
  `permissions`/`permission_details`/`modules`/`actions`, nên **thuộc Feature, không thuộc Core**.

Một role đặc biệt (`PROTECTED_ROLE_CODE` trong `shared/constants.json`) được bỏ qua mọi
kiểm tra quyền chi tiết. Role này không xoá/sửa được qua API.

Các cơ chế bảo vệ đang có, **không được bỏ khi đơn giản hoá code**:

- Khoá tạm 15 phút sau 5 lần đăng nhập sai (`failed_login_attempts`, `locked_until`).
- `bcrypt.compare` với hash giả khi username không tồn tại, để không lộ username qua timing.
- `/forgot-password` luôn trả cùng một response, không lộ email đã đăng ký.
- Refresh token lưu DB dưới dạng SHA-256 hash, rotate mỗi lần refresh, revoke toàn bộ khi
  đặt lại mật khẩu.
- Rate limit 2 tầng: chung theo IP + theo (user, module, action) lấy từ cột
  `actions.rate_limit_per_minute`.

## 7. Logging vs audit log

Hai thứ khác nhau, đừng trộn:

| | Application logging | Audit logging |
|---|---|---|
| Trả lời | hệ thống đang sao | *ai* làm *gì*, lên *đối tượng nào*, *lúc nào*, *kết quả* |
| Thuộc | `core/logger` | `features/audit-logs` |
| Lưu ở | stdout | bảng `audit_logs` trong MySQL |

Không ghi mật khẩu, access/refresh token hay secret vào bất kỳ loại log nào.

## 8. Database

Schema dựng từ `server/database/schema.sql` + `seed.sql`. Thay đổi về sau nằm trong
`server/database/migrations/NNN_*.sql`, chạy bằng runner tự viết
`server/database/migrate.js` (**không** dùng knex migrate API), theo dõi trạng thái trong
bảng `schema_migrations` nên chạy lại nhiều lần vẫn an toàn.

Chi tiết quy ước: xem [database-conventions.md](database-conventions.md) *(chưa viết)*.

## 9. Những gì chưa có

Ghi ở đây để không ai tưởng là đã có:

- Chưa có test tự động nào ngoài `server/tests/smoke.load.js`.
- Chưa có lint cho server (client có eslint).
- Chưa có CI, chưa có Dockerfile.
- Chưa có email provider thật — link đặt lại mật khẩu chỉ log ra console
  (`server/core/mailer.js`).
- Chưa có TypeScript.
