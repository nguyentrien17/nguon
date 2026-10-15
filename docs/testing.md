# Kiểm thử

## 1. Hiện trạng — đọc trước khi tin

Server: unit test dùng **`node:test`** có sẵn trong Node; test tích hợp là script Node thuần gọi
API thật. Client: **vitest** + Testing Library.

| Lệnh | Ở đâu | Cần gì | Kiểm tra gì |
|---|---|---|---|
| `npm test` | `server/tests/unit/*.test.js` | **không** cần DB, không cần server | 91 test: upload qua HTTP thật (multer + chữ ký multipart + magic bytes + lưu/xoá file), guard admin cuối cùng + gán role admin, error handler + bảng dịch, `validateBody`/`validateParams` + schema shared, `authenticate` (session guard), `verifySignature`, `validateEnv` (chạy trong child process), `permissionMiddleware`, `userService` (guard khoá/chiếm tài khoản admin), `authService` (refresh, ngưỡng khoá đăng nhập) |
| `npm run lint` | `server/` | — | ESLint toàn bộ server, **kể cả quy tắc Core không import Features** |
| `npm run smoke` | `server/tests/smoke.load.js` | không cần DB, không cần server chạy | load 22 entry point, `validateEnv()` chạy được, Core không giành việc phân quyền của Feature |
| `npm run test:contract` | `server/tests/contract.api.js` | **cần** server đang chạy + MySQL đã seed | 31 assertion về contract API mà client phụ thuộc |
| `npm run test:security` | `server/tests/users.security.js` | **cần** server đang chạy + MySQL (đã chạy migration 012) | 30 assertion về quyền khoá riêng `MOD_USER:lock` (DELETE cũ -> 404), guard chống chiếm/khoá tài khoản đặc quyền, thu hồi phiên khi đổi password/khoá user, refresh song song, bộ đếm đăng nhập sai nguyên tử, JSON hỏng → 400, validate `:id`, clamp `limit`, rollback transaction |
| `npm run lint` | `client/` | — | eslint toàn bộ `client/src` |
| `npm run build` | `client/` | — | Vite build, bắt lỗi import/alias |
| `npm test` | `client/src/**/*.test.{js,jsx}` | **không** cần server | 78 test vitest + Testing Library (jsdom), xem mục 1c |

**Không có:** test cho migration, test end-to-end trên trình duyệt thật, CI.

## 1c. `client: npm test` — test giao diện

```bash
cd client && npm test          # chạy một lần
cd client && npm run test:watch
```

78 test, ~7 giây. File test đặt **cạnh file được test** (`Form.jsx` ↔ `Form.test.jsx`).
Hạ tầng trong `client/src/test/`:

- `setup.js` — jest-dom matcher, ngôn ngữ cố định `vi`, dọn DOM/localStorage sau mỗi test.
- `render.jsx` — `renderWithProviders(ui)`: bọc Router + ToastProvider. **Không** bọc
  AuthProvider (nó gọi API khôi phục phiên) — test cần `useSession` / `usePermissions` /
  `useModules` thì `vi.mock` đúng module đó, hoặc bọc `<PermissionsProvider permissions={[...]}>` thật.
- `i18nLabel.js` — `label('users.form.emailLabel')`: tìm ô nhập theo key i18n thay vì chép chữ
  tiếng Việt vào test (đổi bản dịch không làm vỡ test).

API của feature được mock ở mức `<feature>Api.js` (`vi.mock('./userApi')`) — test kiểm tra
**payload gửi đi**, không cần server.

Đang phủ:

| Nhóm | Test |
|---|---|
| Logic thuần | `validateForm` với schema thật trong `shared/`, cây quyền (`permissionTree`), lọc cây module, `canOpenModule`, phân trang, dịch mã lỗi / issue zod, `lazyWithRetry` |
| Tương tác | `<Form>`: lỗi dưới từng ô, focus ô lỗi, normalize, lỗi API -> toast, upload file quá lớn / bỏ file; `<FormModal>`: Escape không đóng khi đang lưu; `usePagedList`: race giữa các trang, bộ lọc |
| Điều hướng | `ProtectedRoute`: chuyển sang /login **kèm** trang đang mở, spinner khi khôi phục phiên; `Sidebar`: ẩn module không mở được |
| Form nghiệp vụ | `UserFormModal` (payload tạo/sửa, không gửi mật khẩu trống, chỉ tải role khi có quyền), `RoleFormModal` (tự về tab có lỗi, xoá mô tả -> `null`), `ModuleFormModal` / `ActionFormModal` (viết hoa/thường mã, xoá đường dẫn / giới hạn -> `null`) |

Đã kiểm chứng test bắt lỗi thật bằng cách cố ý làm hỏng code: bỏ `state` trong ProtectedRoute
-> đúng test "quay lại trang cũ" fail; bỏ `?? null` khi sửa role -> đúng test "xoá mô tả" fail.

Chưa phủ: các trang danh sách đầy đủ (Users, Permissions, ModuleActions) ở mức toàn trang,
Login / quên / đặt lại mật khẩu, LanguageSwitcher.

## 1b. `npm test` — unit test

```bash
cd server && npm test
```

Viết test mới trong `server/tests/unit/<tên>.test.js`, dòng đầu luôn là
`require('./_helpers')`: nó đặt env cố định (không phụ thuộc `server/.env` của từng máy) và
**trỏ DB vào port 1**. Unit test không được chạm DB — service được test bằng cách thay model
qua `mock.method(userModel, 'findById', ...)`. Quên mock một hàm model thì query thật bị
ECONNREFUSED và test fail ngay, thay vì âm thầm ghi vào MySQL trên máy dev.

`mock.method` chỉ hoạt động vì service gọi model **qua object** (`userModel.findById(...)`).
Đừng đổi sang destructure (`const { findById } = require(...)`) ở service — sẽ không mock được.

Đã kiểm chứng test có bắt lỗi thật: tạm bỏ guard khoá admin trong `toggleUserStatus` thì đúng
2 test liên quan fail.

## 2. `npm run smoke` — kiểm tra đường dẫn

Chạy mỗi khi bạn di chuyển file hoặc đổi require/alias. Nó phát hiện ngay loại lỗi mà
refactor cấu trúc hay gây ra:

```bash
cd server && npm run smoke
```

Vì knex tạo connection pool **lazy** (chỉ connect ở query đầu tiên), script này load được toàn
bộ model mà không cần MySQL bật.

Thêm module mới thì thêm vào mảng `ENTRY_POINTS` nếu nó **không** nằm trên cây require của
`../routes` (middleware chỉ được dùng ở vài route, helper gọi theo nhánh, v.v.).

## 3. `npm run test:contract` — khoá contract với client

```bash
cd server && npm run dev        # terminal 1
cd server && npm run test:contract   # terminal 2
```

Danh sách field được kiểm tra không phải bịa — nó được rút ra bằng cách grep toàn bộ
`client/src` tìm mọi chỗ đọc response. Client chỉ đọc 7 field: `accessToken`, `signingKey`,
`user`, `permissions`, `pagination`, `errorCode`, `message`.

Test này tồn tại vì ba thứ rất dễ bị "sửa cho đẹp" rồi phá client một cách âm thầm:

1. `pagination` → `meta` làm vỡ 3 trang.
2. `errorCode` phẳng → `error.code` làm vỡ `getErrorMessage` **và nhánh tự động refresh token**
   trong `axiosClient.js` — lỗi chỉ lộ ra sau 15 phút sử dụng.
3. `accessToken` ngang cấp → bọc trong `data` làm vỡ login.

Nếu một assertion fail, đọc [api-conventions.md](api-conventions.md) trước khi đổi test.

Biến môi trường ghi đè được: `TEST_API_URL`, `TEST_USERNAME`, `TEST_PASSWORD`.

## 3b. `npm run test:security`

Test này **tạo rồi tự xoá** dữ liệu của nó: 1 role tạm (`ROLE_SECTEST_TMP`, gồm
`MOD_USER:view/edit/delete`) và 2 user tạm (tiền tố `sectest_`). Nó ghi lại `status` gốc của
superadmin và trả về như cũ trong `cleanup` — phòng khi guard khoá-admin hỏng và bước 13 lỡ khoá
được tài khoản này. Dọn dẹp chạy trong `finally` nên vẫn sạch khi test fail giữa đường, và
đầu mỗi lần chạy nó dọn lại sót của lần trước.

Nó **không sửa dữ liệu có sẵn** — đặc biệt không đổi mật khẩu `superadmin`: bước cốt lõi là
kiểm tra request đó bị **từ chối** 403, và có hai assertion xác nhận mật khẩu cũ vẫn đăng nhập
được còn mật khẩu kẻ tấn công đặt thì không.

Dù vậy, **đừng chạy trên database production** — nó vẫn ghi `audit_logs` và tạo/revoke refresh token.

**Lưu ý về rate limit:** `loginLimiter` giới hạn **5 request/phút/IP** trên `/auth/login`.
`test:contract` dùng 1 lần, `test:security` dùng 4 lần — chạy liền nhau là 5, đúng sát trần.
Thêm một assertion cần đăng nhập nữa là test sẽ fail vì 429 chứ không phải vì code sai. Vì vậy
`test:security` **đếm số lần đăng nhập và báo lỗi tường minh khi gặp 429** thay vì để assertion
fail với thông báo vô nghĩa. Nếu gặp, chờ 1 phút rồi chạy lại — hoặc chạy server dev với
`LOGIN_RATE_LIMIT_MAX=50`. Các test mới cố ý **không** đăng nhập thêm: refresh song song và đổi
mật khẩu dùng lại phiên sẵn có, bộ đếm đăng nhập sai được kiểm tra bằng cách gọi thẳng model.

Test gửi `PUT /auth/me` với **chính giá trị hiện tại** của tài khoản nên không làm đổi dữ liệu,
nhưng nó **có** tạo bản ghi trong `audit_logs` và revoke/cấp lại refresh token. Đừng chạy trên
database production.

## 4. Kiểm tra quy tắc phụ thuộc

**Core không import Feature** giờ là luật ESLint (`no-restricted-syntax` trong
`server/eslint.config.js`, áp cho `core/**`) — `npm run lint` fail nếu vi phạm, bắt cả
`require('#features/...')` lẫn `require('../../features/...')`.

Còn một lệnh grep, nên đưa vào CI khi có CI:

```bash
# Shared chỉ được phụ thuộc zod — phải không có output
grep -rn "^import " shared/ | grep -v "from 'zod'" | grep -v "from '\./"
```

## 5. Việc chưa làm được tự động — phải kiểm tra bằng tay

Đây là danh sách thật, không phải cho đủ hình thức. **Chưa có test nào phủ những mục này:**

### 5.1. Giao diện

Lint + build + Vite dev server chứng minh module resolve đúng, **không** chứng minh app render
đúng. Sau mỗi lần sửa frontend, phải tự:

- [ ] Đăng nhập được bằng `superadmin`
- [ ] Vào được từng trang: Dashboard, Users, Permissions, Module & Action, Audit Logs, Profile
- [ ] Sidebar hiện đúng module theo quyền
- [ ] Đổi ngôn ngữ vi/en/zh, thông báo lỗi đổi theo
- [ ] Để phiên hết hạn (hoặc chờ 15 phút) → request kế tiếp tự refresh, **không** bị đăng xuất
      và **không** gửi 2 request refresh song song
- [ ] Đăng xuất rồi reload → không vào được trang nội bộ
- [ ] Toast hiện khi phiên hết hạn

Mục cuối của nhánh refresh là chỗ dễ vỡ nhất và không bắt được bằng build.

### 5.2. Thứ tự Provider

`ToastProvider` phải bọc ngoài `AuthProvider` (SessionProvider gọi `useToast`). Đổi thứ tự thì
**build vẫn pass** nhưng app crash lúc runtime.

### 5.3. Migration

Chưa có test nào chạy migration trên DB thử. Trước khi chạy migration trên DB thật:

```bash
mysqldump -u root -p rbac_portal > backup.sql
mysql -u root -p -e "CREATE DATABASE rbac_test"
mysql -u root -p rbac_test < server/database/schema.sql
mysql -u root -p rbac_test < server/database/seed.sql
# rồi trỏ DB_NAME=rbac_test và chạy npm run migrate
```

Lưu ý `migrate.js` **không** chạy trong transaction và MySQL không rollback DDL.

### 5.4. Luồng quên mật khẩu

Hiện link reset chỉ được log ra console server, nên không test tự động được end-to-end. Kiểm
tra bằng tay: gọi `/auth/forgot-password`, lấy link từ log server, mở nó, đặt mật khẩu mới,
xác nhận mọi phiên cũ bị đăng xuất.

Phần `/auth/reset-password` (sau khi đã có token) đã được kiểm tra một lần bằng script tạm chèn
token thẳng vào DB: hai request song song cùng một link → một 200, một 400
`ERR_INVALID_RESET_TOKEN`; mọi refresh token bị revoke; dùng lại link → 400. Script này chưa
được đưa vào bộ test cố định vì mỗi lần chạy tốn 3 lượt `loginLimiter`.

## 6. Thứ tự bổ sung test đề xuất

Theo mục 13 của kế hoạch refactor, làm từng bước, không viết thật nhiều test trước khi cấu trúc
ổn định:

1. ✅ Smoke test khởi động server — **đã có**
2. ✅ Test thiếu biến môi trường — `validateEnv.test.js` chạy từng trường hợp trong child process
3. ✅ Test error handler và validator dùng chung — `errors.test.js`, `validate.test.js`
4. ✅ Test đăng nhập, refresh, logout, quyền truy cập — unit (`security.test.js`,
   `services.test.js`) + contract/security test
5. ✅ Test các service quan trọng — **một phần**: `userService`, `authService`,
   `permissionMiddleware`. Chưa có: `permissionService`, `moduleService`, `actionService`
6. ✅ Test API cho users và RBAC — **một phần** trong contract test
7. ⬜ Test migration trên database thử nghiệm
8. ✅ Lint cho server — ⬜ CI

Server dùng **node:test** (có sẵn trong Node, server là CommonJS nên không hưởng lợi gì từ cấu
hình Vite). Client dùng **vitest** (dùng chung cấu hình Vite: alias `@`, `@shared`, plugin React).

## 7. Quy tắc báo cáo kết quả test

Mục 13 của kế hoạch refactor: **"Không tuyên bố test đã chạy thành công nếu chưa thực sự chạy."**

Khi báo cáo, ghi rõ lệnh nào đã chạy, kết quả thế nào, và phần nào **chưa** kiểm tra. "Build
pass" không đồng nghĩa "chức năng đúng".
