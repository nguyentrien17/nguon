# Cấu trúc thư mục

Mô tả cấu trúc **hiện tại sau đợt refactor đầu**. Phần frontend vẫn ở cấu trúc cũ, xem
mục "Việc còn tồn đọng".

## Toàn cảnh

```
.
├── client/            React + Vite SPA
├── server/            Express API
├── shared/            dùng chung client ↔ server (constants, zod, bảng dịch lỗi)
├── docs/              tài liệu kiến trúc (thư mục này)
├── tailieu/           tài liệu gốc của dự án (SRS, kế hoạch refactor)
└── package.json       chỉ cung cấp node_modules (zod) cho shared/
```

`tailieu/` được **giữ lại**, không gộp vào `docs/`: nó chứa tài liệu đầu vào của dự án
(SRS dạng .docx, kế hoạch refactor), khác loại với tài liệu kiến trúc do code sinh ra.

## Backend

```
server/
├── server.js                 bootstrap: middleware chain, mount routes, listen, graceful shutdown
├── package.json              alias #shared, #core/*, #features/*
├── .env.example
│
├── core/                     ◄── HẠ TẦNG. Không chứa nghiệp vụ, không import features/
│   ├── config/
│   │   ├── env.js            ĐIỂM DUY NHẤT đọc process.env (tự gọi dotenv.config())
│   │   └── validateEnv.js    fail-fast khi thiếu biến bắt buộc; cảnh báo NODE_ENV/placeholder
│   ├── database/
│   │   ├── db.js             knex instance + connection pool
│   │   └── baseRepository.js factory CRUD dùng chung cho mọi Model
│   ├── errors/
│   │   ├── AppError.js       lớp lỗi ứng dụng (statusCode, errorCode, params)
│   │   ├── errorHandler.js   middleware xử lý lỗi tập trung (đặt cuối chain)
│   │   └── errorMessages.js  tra bản dịch lỗi theo locale + interpolation
│   ├── http/
│   │   ├── asyncHandler.js   bọc controller async → đẩy lỗi về errorHandler
│   │   ├── validate.js       validateBody(zodSchema)
│   │   └── locale.js         đọc header X-Locale → req.locale
│   ├── security/
│   │   ├── authenticate.js   verify access token → req.user  (AUTHENTICATION)
│   │   ├── jwt.js            sign/verify access + refresh token
│   │   ├── verifySignature.js HMAC chữ ký request
│   │   └── rateLimiter.js    loginLimiter, apiLimiter (theo IP)
│   ├── utils/
│   │   └── auditDiff.js      buildFieldDiff — so sánh field, không biết tên bảng nào
│   ├── logger.js             application logging (error/warn/info/debug)
│   └── mailer.js             gửi email (hiện chỉ log ra console)
│
├── features/                 ◄── NGHIỆP VỤ. Được dùng core/ và shared/
│   ├── auth/                 login, refresh, logout, profile, quên/đặt lại mật khẩu
│   │   ├── authRoutes.js  authController.js  authService.js  authValidators.js
│   │   ├── refreshTokenModel.js
│   │   └── passwordResetTokenModel.js
│   ├── users/
│   │   ├── userRoutes.js  userController.js  userService.js  userModel.js  userValidators.js
│   │   └── userExport.js         workbook Excel của bảng users (trước ở utils/exportExcel.js)
│   ├── permissions/              roles + gán role
│   │   ├── permissionRoutes.js  ...Controller  ...Service  ...Model  ...Validators
│   │   ├── permissionMiddleware.js  requirePermission/requireAnyPermission  (AUTHORIZATION)
│   │   └── permissionDiff.js        buildPermissionDiff (trước ở utils/auditDiff.js)
│   ├── modules/
│   ├── actions/
│   │   └── actionRateLimiter.js  rate limit theo actions.rate_limit_per_minute
│   ├── audit-logs/
│   └── insights/
│
├── routes/index.js           mount 7 feature router dưới API_PREFIX
├── database/
│   ├── schema.sql  seed.sql
│   ├── migrations/           001..010_*.sql, chạy theo thứ tự tên file
│   └── migrate.js            runner tự viết, tracking ở bảng schema_migrations
└── tests/
    └── smoke.load.js         load toàn bộ import graph, không cần DB  (npm run smoke)
```

### Alias

Khai trong `server/package.json → imports` (cơ chế subpath imports của Node, không cần
thư viện nào):

| Alias | Trỏ tới | Ví dụ |
|---|---|---|
| `#shared` | `./shared.js` → `shared/constants.json` | `require('#shared')` |
| `#core/*` | `./core/*.js` | `require('#core/errors/AppError')` |
| `#features/*` | `./features/*.js` | `require('#features/users/userModel')` |

**Dùng alias, đừng dùng `../../`** cho mọi thứ cắt qua ranh giới thư mục. Lý do cụ thể:
khi `errorMessages.js` chuyển từ `utils/` xuống `core/errors/`, đường dẫn tương đối
`../../shared/errorMessages.json` của nó bị sai thêm một cấp — đúng loại lỗi mà alias
loại bỏ được.

Hai ngoại lệ còn dùng đường dẫn tương đối, có chủ ý:

1. **Nội bộ trong cùng một thư mục `core/` hoặc cùng một feature** — `require('./db')`,
   `require('./permissionModel')`. Ngắn và rõ ràng hơn alias.
2. **`features/*/...Validators.js` trỏ ra `../../../shared/validators/`** — ở đây **không thể**
   dùng alias. Cơ chế `imports` của Node từ chối mọi target nằm ngoài thư mục package
   (`"#shared/*": "../shared/*"` → `ERR_INVALID_PACKAGE_TARGET`, đã thử). `#shared` hiện hoạt
   động được chỉ vì nó trỏ tới `./shared.js` — một file *bên trong* `server/` làm shim re-export
   `../shared/constants.json`. Muốn có `#shared/*` thì phải tạo một file shim cho từng file con
   của `shared/`, tức thêm 7 file chỉ để tránh một đường dẫn tương đối — không đáng.

### Quy tắc đặt tên

- File trong feature mang **tiền tố tên feature số ít**: `userService.js`, không phải
  `service.js`. Mở 10 tab editor vẫn phân biệt được tab nào thuộc feature nào.
- Thư mục feature dùng **số nhiều hoặc gạch nối**: `users/`, `audit-logs/`.
- Thư mục trong `core/` đặt theo **chức năng kỹ thuật**: `errors/`, `http/`, `security/`.

## Frontend

```
client/src/
├── main.jsx                  entry duy nhất (index.html trỏ vào đây): StrictMode,
│                             ErrorBoundary, BrowserRouter
├── index.css
│
├── app/                      ◄── KHỞI TẠO ỨNG DỤNG
│   ├── App.jsx               lắp providers + Suspense boundary
│   ├── App.css
│   ├── NotFound.jsx
│   ├── router/AppRoutes.jsx  CHỈ chứa bảng route
│   ├── providers/ToastContext.jsx
│   └── layout/               Layout.jsx, Sidebar.jsx
│
├── core/                     ◄── HẠ TẦNG FE
│   ├── api/
│   │   ├── axiosClient.js    axios instance + interceptor refresh token + ký request
│   │   └── requestSigning.js HMAC phía client (phải khớp core/security/verifySignature.js)
│   ├── auth/AuthContext.jsx  session, login/logout, can(), canAccessModule()
│   ├── permissions/          ProtectedRoute.jsx, ActionGuard.jsx
│   └── errors/               errorMessage.js, zodErrorMessage.js, ErrorBoundary.jsx
│
├── components/ui/            Spinner, EmptyState, ConfirmDialog, LanguageSwitcher
│
├── features/                 ◄── NGHIỆP VỤ (trước đây là pages/)
│   ├── auth/                 Login, ForgotPassword, ResetPassword
│   ├── users/                Users, UserRolesModal
│   ├── permissions/          Permissions, permissionPresets.js
│   ├── module-actions/       ModuleActions
│   ├── audit-logs/           AuditLogs
│   ├── dashboard/            Dashboard, StatCard
│   └── profile/              Profile
│
├── constants/moduleIcons.js  dùng bởi app/layout/Sidebar VÀ features/module-actions,
│                             nên để ở cấp dùng chung chứ không nhét vào một feature
├── i18n/                     index.js + locales/{vi,en,zh}/translation.json
└── assets/
```

Alias: `@` → `client/src`, `@shared` → `shared/` (khai cả ở `vite.config.js` và
`jsconfig.json` — sửa một nơi thì phải sửa nơi kia).

**Mọi import cắt qua ranh giới thư mục đều dùng `@/`.** Sau đợt refactor không còn import
`../` nào trong `client/src` ngoại trừ trong cùng một thư mục (`./StatCard`,
`./UserRolesModal`, `./permissionPresets`, `./locales/...`).

Hai thứ cần giữ đúng thứ tự, nếu đổi sẽ vỡ lúc runtime mà build vẫn pass:

1. **`ToastProvider` phải bọc ngoài `AuthProvider`** — `AuthContext` gọi `useToast()` để báo
   phiên hết hạn.
2. **`core/api/requestSigning.js` phải khớp thuật toán với `server/core/security/verifySignature.js`**
   (HMAC-SHA256 trên `"${timestamp}.${rawBody}"`), và danh sách `UNSIGNED_URLS` trong
   `axiosClient.js` phải khớp các route không gắn `verifySignature` ở backend.

## Việc còn tồn đọng

Xếp theo thứ tự nên làm:

1. **Kiểm chứng UI bằng tay.** Cấu trúc frontend đã chuyển và `npm run lint`, `npm run build`,
   Vite dev server đều pass, nhưng **chưa ai bấm thử giao diện** sau khi di chuyển. Cần đăng
   nhập, vào từng trang, thử đổi mật khẩu và để phiên hết hạn một lần.
2. **Tách `AuthContext`** — hiện gánh cả session, permissions và danh sách modules. Kế hoạch
   refactor (mục 11) khuyên tách, nhưng việc này đổi hành vi render nên để thành đợt riêng.
3. **Đồng bộ zod** — `server` đang ở `4.5.4` còn root/client ở `4.6.1`, trong khi cả hai
   bên load cùng một schema trong `shared/validators/`.
4. **Gom `features/rbac/`** (backend) — đưa `permissions/`, `modules/`, `actions/` vào một
   thư mục. Đã hoãn có chủ ý: nó sửa `#features/permissions/*` ở 8 file mà không giúp gì cho
   ranh giới Core/Feature, vốn là mục tiêu của đợt đầu.
5. **`shared/` là CommonJS, client là ESM** — hiện chạy được nhờ Vite interop, sẽ vỡ nếu
   root `package.json` thêm `"type": "module"` hoặc khi dùng `shared/` trong test runner ESM.
6. **Các tài liệu còn thiếu** trong `docs/`: `coding-conventions.md`,
   `database-conventions.md`, `security.md`, `testing.md`, `development-guide.md`.
