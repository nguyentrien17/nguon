# Bảo mật

Tài liệu này ghi lại các cơ chế bảo vệ **đang có** và giới hạn thật của chúng. Mục 10 của kế
hoạch refactor ghi: "Không loại bỏ cơ chế bảo vệ hiện có chỉ vì muốn đơn giản hoá code" — danh
sách dưới đây là thứ cần giữ.

## 1. Authentication

| Thành phần | Chi tiết |
|---|---|
| Access token | JWT HS256, mặc định 15 phút, gửi qua header `Authorization: Bearer` |
| Refresh token | JWT HS256, mặc định 7 ngày, trong **HttpOnly cookie**, `sameSite: strict`, `path: ${API_PREFIX}/auth` (= `/api/auth`) |
| Lưu refresh token | DB lưu **SHA-256 hash**, không lưu token gốc |
| Rotation | Mỗi lần `/auth/refresh` thì token cũ bị `revoke` và cấp token mới. Kiểm tra + revoke là **một câu `UPDATE` nguyên tử** (`refreshTokenModel.consume`): hai request song song cùng một token thì chỉ một cái được cấp phiên mới |
| Session guard | `authenticate` hỏi `authService.isSessionActive` (đăng ký ở `server.js`) ở **mỗi request**: user bị khoá/xoá thì access token còn hạn cũng bị từ chối ngay (401 `ERR_TOKEN_EXPIRED` → client refresh → bị từ chối → đăng xuất) |
| Password hashing | bcrypt, cost **12** |
| JWT secret | `validateEnv`: < 32 ký tự hoặc access = refresh secret → **dừng ở production**, cảnh báo ở môi trường khác |

**Client phải gọi refresh qua `refreshSession()`** (`core/api/axiosClient.js`), không gọi thẳng
`axiosClient.post('/auth/refresh')`. Vì rotation nguyên tử, hai request refresh song song cùng
cookie sẽ có một cái nhận 401 và client tự xoá phiên — `refreshSession()` gộp chúng về một
promise (kể cả khi React StrictMode chạy effect khởi tạo hai lần).

**Access token không được lưu vào `localStorage`.** Client giữ nó trong biến module
(`core/api/axiosClient.js`), mất khi reload trang, và khôi phục phiên bằng cách gọi
`/auth/refresh` dựa trên HttpOnly cookie. Đây là lựa chọn có chủ ý chống XSS đánh cắp token.

### Cờ `Secure` của cookie phụ thuộc `NODE_ENV`

`features/auth/authController.js` đặt `secure: env.isProduction`. **Deploy production mà quên
`NODE_ENV=production` thì refresh token cookie đi qua HTTP không mã hoá.** `validateEnv` cảnh
báo khi thiếu biến này nhưng không dừng server — đã cân nhắc: dừng server vì thiếu một biến
không bắt buộc sẽ phá luồng dev hiện có.

## 2. Authorization

**Quyền được đọc lại từ DB ở mỗi request**, không lấy từ payload JWT
(`features/permissions/permissionMiddleware.js`). Nhờ vậy thu hồi quyền có hiệu lực ngay ở
request kế tiếp thay vì phải chờ access token hết hạn.

Token *vẫn* chứa danh sách quyền, nhưng **chỉ để client dựng UI**. Đừng dùng nó để quyết định
ở backend.

`PROTECTED_ROLE_CODE` (trong `shared/constants.json`) là role được bỏ qua mọi kiểm tra quyền
chi tiết. Role này không xoá/sửa được qua API.

**Quyền phải được kiểm tra ở backend.** `ProtectedRoute` và `ActionGuard` ở client chỉ để trải
nghiệm người dùng đúng; ẩn giao diện **không phải** biện pháp bảo mật.

## 3. Chống dò và brute force

| Cơ chế | Vị trí | Thông số |
|---|---|---|
| Khoá tạm sau đăng nhập sai | `authService.login` | 5 lần sai → khoá 15 phút (`failed_login_attempts`, `locked_until`). Bộ đếm tăng **trong DB** (`userModel.incrementFailedLogin`) để request song song không làm mất lần đếm |
| Rate limit đăng nhập | `core/security/rateLimiter.js` | `LOGIN_RATE_LIMIT_MAX` (mặc định 5) req/phút/IP trên `/auth/login`, `/forgot-password`, `/reset-password` |
| Rate limit chung | `core/security/rateLimiter.js` | 300 req/phút/IP toàn bộ `/api` |
| Rate limit theo action | `features/actions/actionRateLimiter.js` | theo cột `actions.rate_limit_per_minute`, tính theo (user, module, action) |

**Chống timing attack dò username:** khi username không tồn tại, `authService.login` vẫn chạy
`bcrypt.compare` với một hash giả (`DUMMY_PASSWORD_HASH`) để thời gian phản hồi tương đương
trường hợp sai mật khẩu. Đừng "tối ưu" bỏ dòng này.

**Chống dò email:** `/auth/forgot-password` luôn trả về cùng một response thành công bất kể
email có tồn tại hay không.

**`trust proxy`:** `server.js` đặt `app.set('trust proxy', env.TRUST_PROXY)`. **Mặc định
`false`** (không tin `X-Forwarded-For`). Rate limit và audit log phụ thuộc vào giá trị này:

- Chạy sau **đúng 1** reverse proxy (nginx/Cloudflare...) → `TRUST_PROXY=true`; nhiều tầng →
  số nguyên bằng số proxy. Không đặt thì mọi request mang IP của proxy và cả hệ thống dùng
  chung một hạn mức rate limit.
- **Không** có proxy mà đặt `true` → client tự gửi `X-Forwarded-For` giả và vượt rate limit.

(Trước đây mặc định là tin 1 proxy — đổi sang `false` để cấu hình thiếu thì an toàn thay vì hổng.)

## 4. Đặt lại mật khẩu

- Token là 32 byte random, DB lưu SHA-256 hash, TTL 30 phút.
- Dùng token (`SELECT ... FOR UPDATE` rồi đánh dấu `used`), đổi mật khẩu, vô hiệu link cũ và
  revoke phiên chạy trong **một transaction** — hai request song song cùng một link thì chỉ
  một cái thành công.
- **Reset thành công thì revoke toàn bộ refresh token của user** — mọi phiên cũ (kể cả của kẻ
  đã chiếm được quyền truy cập trước đó) phải đăng nhập lại.
- **User tự đổi mật khẩu** (`PUT /auth/password`) thì revoke mọi phiên **khác**, giữ phiên đang
  thao tác (nhận diện qua refresh cookie gửi kèm request).
- Hiện **chưa có email provider thật**: link reset chỉ được `logger.info` ra console server
  (`core/mailer.js`). **Phải thay bằng provider thật trước khi dùng production** — hiện tại bất
  kỳ ai đọc được log server đều lấy được link đặt lại mật khẩu của mọi user.

## 5. Chữ ký request (`verifySignature`)

HMAC-SHA256 trên `"${timestamp}.${rawBody}"`, so sánh bằng `crypto.timingSafeEqual`, cửa sổ
chấp nhận ±5 phút. Khoá ký (`sigKey`) sinh mới mỗi lần login/refresh.

**Giới hạn phải hiểu rõ:** `sigKey` nằm ngay trong payload JWT (chỉ base64, không mã hoá), nên
**nếu access token bị đánh cắp thì sigKey mất theo**. Middleware này:

- ✅ chống sửa đổi request trên đường truyền (proxy trung gian không tin cậy, route sai cấu hình)
- ❌ **không** chống session hijacking hay replay bởi chính bên đang cầm token
- ❌ **không** thay thế TLS

URL và HTTP method **không** được đưa vào chuỗi ký (đánh đổi có chủ ý, tránh lệch chuẩn hoá
path giữa client và server) — nghĩa là một request đã ký có thể bị đổi sang endpoint khác cùng
method nếu body giống nhau.

Danh sách route không ký ở backend phải khớp `UNSIGNED_URLS` trong
`client/src/core/api/axiosClient.js`. Sửa một bên thì sửa cả bên kia.

## 6. HTTP headers và CORS

- `helmet()` với cấu hình mặc định.
- CORS: chỉ `env.CLIENT_ORIGIN` (mặc định `http://localhost:5173`), `credentials: true`.
  Một origin duy nhất — thêm origin thứ hai phải sửa `server.js`.
- Body limit 200 kB. Vượt → 413; JSON sai cú pháp → 400 (`errorHandler` bắt lỗi của
  body-parser, không để rơi xuống 500).

## 7. Dữ liệu không được ghi log

**Không bao giờ** ghi vào application log hay audit log: mật khẩu (thô hoặc hash), access token,
refresh token, `sigKey`, token đặt lại mật khẩu, nội dung `.env`.

`errorHandler` log `method`, `originalUrl`, `user.id` và object lỗi — **không log body hay
header**. Giữ nguyên như vậy khi thêm log.

Stack trace không bao giờ ra tới client: lỗi không phải `AppError` luôn trả về thông báo chung
500. Contract test có assertion cho việc này.

## 8. SQL injection

Mọi truy vấn đi qua knex với tham số bind. `multipleStatements` **chỉ** bật trên connection
riêng của `database/migrate.js`, không bật trên pool chính của app — cố ý thu hẹp bề mặt tấn công.

Khi dùng `db.raw`, luôn truyền tham số dạng `db.raw('... ?', [value])`, không nội suy chuỗi.

## 9. Chống chiếm tài khoản đặc quyền

`userService.assertCanTakeOverAccount` chặn việc đổi `password` **hoặc** `email` của một tài
khoản đang giữ `PROTECTED_ROLE_CODE` bởi actor không giữ role đó.

Vì sao cần: đổi được thông tin đăng nhập của một tài khoản là chiếm được tài khoản đó — đặt
password mới rồi đăng nhập, hoặc đổi email rồi dùng luồng `/forgot-password`. Nếu không chặn,
một actor chỉ có `MOD_USER:edit` sẽ chiếm được tài khoản Administrator và bỏ qua toàn bộ hệ
thống phân quyền chi tiết.

Guard chỉ áp dụng khi **đối tượng bị sửa** giữ protected role. Tự sửa chính mình, và sửa tài
khoản thường, không bị ảnh hưởng.

Đổi password qua `updateUser` cũng **revoke toàn bộ refresh token** của user đó và reset
`failed_login_attempts`/`locked_until` — nếu không, user vừa bị đổi mật khẩu vẫn giữ nguyên
phiên đăng nhập trong tối đa 7 ngày.

Cùng guard này (với `actionKey: 'lock'`) chặn **actor không phải Administrator khoá/mở khoá
tài khoản Administrator** qua `DELETE /users/:id` — nếu không, quyền `MOD_USER:delete` đủ để khoá
toàn bộ admin ra khỏi hệ thống. Khoá một user cũng **revoke toàn bộ refresh token** của user đó.

Được phủ bởi `npm run test:security` (27 assertion), gồm cả việc kiểm tra guard **không** chặn
quá rộng.

## 10. Vấn đề bảo mật đã biết, CHƯA sửa

### 10.1. `DELETE /api/users/:id` thực ra là khoá/mở khoá

Cả hai chiều đều đòi quyền `MOD_USER:delete`, nên không thể cấp quyền "mở khoá tài khoản" mà
không cấp luôn quyền mang tên "xoá". Cần đổi thành `PATCH /api/users/:id/status` kèm sửa client.

### 10.2. Administrator khoá được Administrator khác

`toggleUserStatus` chặn **tự khoá chính mình** (`ERR_SELF_LOCK`) và chặn **actor thường** khoá
admin (mục 9), nhưng admin A vẫn khoá được admin B — kể cả khi B là admin còn lại duy nhất.

**Cố ý không chặn:** khoá tài khoản là hành động **đảo ngược được** (mở khoá lại), và việc khoá
gấp một tài khoản admin bị xâm nhập là nhu cầu chính đáng. Khác với 9: chiếm thông tin đăng nhập
thì không đảo ngược được. Nếu muốn chặn, phải xử lý được kịch bản "admin cuối cùng" trước.

### 10.3. Chưa có email provider thật

Xem mục 4 — link đặt lại mật khẩu đang được log ra console server.

### 10.4. `sigKey` nằm trong payload JWT

Xem mục 5 — giới hạn thiết kế đã biết của `verifySignature`.
