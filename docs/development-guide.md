# Hướng dẫn phát triển

## 1. Yêu cầu môi trường

| | Phiên bản |
|---|---|
| Node.js | `^20.19.0 \|\| >=22.12.0` (do Vite 8 yêu cầu; khai trong `engines`, `.nvmrc` = 22; đã kiểm tra trên **22.19.0**) |
| MySQL | 8+ |
| npm | đi kèm Node |

Repo có **ba** `package.json` và phải `npm install` ở cả ba:

| Thư mục | Vai trò |
|---|---|
| `/` (root) | chỉ cung cấp `node_modules` (zod) cho `shared/validators` — không có code chạy |
| `/server` | API |
| `/client` | SPA |

## 2. Cài đặt từ đầu

```bash
# 1. Dependencies
npm install              # ở root — cần cho shared/validators
cd server && npm install
cd ../client && npm install

# 2. Database
mysql -u root -p < server/database/schema.sql
mysql -u root -p rbac_portal < server/database/seed.sql
cd server && npm run migrate -- --baseline

# 3. Cấu hình
cd server && cp .env.example .env
# rồi điền DB_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET thật

# 4. Kiểm tra nhanh (không cần MySQL bật)
cd server && npm run smoke
```

`--baseline` ở bước 2 chỉ đánh dấu các migration là "đã áp dụng" mà không thực thi — đúng cho
DB vừa dựng từ `schema.sql` (file đó đã chứa sẵn kết quả mọi migration). Thiếu cờ này, migrate
sẽ lỗi "duplicate column". Xem [database-conventions.md](database-conventions.md).

Tài khoản sau seed: `superadmin` / `Admin@123`.

## 3. Chạy hằng ngày

```bash
cd server && npm run dev     # nodemon, http://localhost:5000
cd client && npm run dev     # vite,     http://localhost:5173
```

Client gọi API qua `VITE_API_URL`, mặc định
`http://localhost:${DEFAULT_SERVER_PORT}${API_PREFIX}` lấy từ `shared/constants.json`.

## 4. Toàn bộ script có sẵn

**server/**

| Lệnh | Việc |
|---|---|
| `npm run dev` | nodemon |
| `npm start` | node server.js |
| `npm run migrate` | chạy migration chưa áp dụng |
| `npm run migrate -- --baseline` | đánh dấu đã áp dụng, không thực thi |
| `npm run smoke` | load toàn bộ import graph, không cần DB |
| `npm run test:contract` | 31 assertion contract API (cần server đang chạy) |
| `npm run test:security` | 27 assertion guard bảo mật user/phiên (cần server đang chạy) |
| `npm run audit` | `npm audit --omit=dev` |

**client/**

| Lệnh | Việc |
|---|---|
| `npm run dev` / `build` / `preview` | Vite |
| `npm run lint` | eslint |
| `npm run audit` | `npm audit --omit=dev` |

**root/**: chỉ `npm run audit`.

## 5. Biến môi trường

| Biến | Bắt buộc | Mặc định | Ghi chú |
|---|---|---|---|
| `DB_HOST` `DB_USER` `DB_PASSWORD` `DB_NAME` | ✅ | — | thiếu → server dừng ngay lúc khởi động |
| `DB_PORT` | | `3306` | |
| `JWT_ACCESS_SECRET` `JWT_REFRESH_SECRET` | ✅ | — | như trên. Phải ≥ 32 ký tự và khác nhau — production dừng nếu vi phạm, dev chỉ cảnh báo |
| `NODE_ENV` | ⚠️ | `development` | **production PHẢI set** — cờ `Secure` của cookie refresh token phụ thuộc vào nó. Thiếu thì server chỉ *cảnh báo* |
| `PORT` | | `5000` | từ `DEFAULT_SERVER_PORT` |
| `CLIENT_ORIGIN` | | `http://localhost:5173` | dùng cho CORS **và** link đặt lại mật khẩu |
| `TRUST_PROXY` | | `false` | `true` (1 proxy) hoặc số proxy khi chạy sau reverse proxy — xem [security.md](security.md) mục 3 |
| `LOGIN_RATE_LIMIT_MAX` | | `5` | số lần login/forgot/reset mỗi phút mỗi IP. Có thể nới khi chạy test liên tục trên máy dev |
| `JWT_ACCESS_EXPIRES_IN` | | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | | `7d` | |
| `LOG_LEVEL` | | `debug` (dev) / `info` (prod) | `error`\|`warn`\|`info`\|`debug` |
| `VITE_API_URL` | | suy ra từ shared constants | client — xem `client/.env.example`. **Phải đặt khi build production** (nhúng cứng lúc build) |

**Mọi biến chỉ được đọc ở `server/core/config/env.js`.** Thêm biến mới thì thêm vào đó, vào
`.env.example`, và vào bảng này.

Ở production, nếu một secret bắt buộc còn mang giá trị placeholder của `.env.example`,
`validateEnv` sẽ **dừng server**.

## 6. Thêm một feature backend mới

Ví dụ feature `invoices`:

1. `server/features/invoices/` với 5 file theo khuôn
   (`invoiceRoutes/Controller/Service/Model/Validators.js`) — xem `features/users/` làm mẫu.
2. Schema zod đặt ở `shared/validators/invoiceValidators.js`, file
   `features/invoices/invoiceValidators.js` chỉ re-export.
3. Thêm `MODULE_CODE.INVOICE` vào `shared/constants.json`.
4. Mount trong `server/routes/index.js`:
   ```js
   router.use('/invoices', require('#features/invoices/invoiceRoutes'));
   ```
5. Thêm module + action vào DB bằng một migration mới, hoặc tạo qua trang Module & Action.
6. `npm run smoke` — nếu feature có module nào không nằm trên cây require của `routes`, thêm
   vào `ENTRY_POINTS` của smoke test.

Đọc [coding-conventions.md](coding-conventions.md) trước khi viết file đầu tiên.

## 7. Thêm một trang frontend mới

1. `client/src/features/<tên>/<Tên>.jsx`.
2. Khai lazy route trong `client/src/app/router/AppRoutes.jsx`, bọc `ProtectedRoute` với
   `moduleCode` tương ứng.
3. Thêm khoá dịch vào cả ba file `client/src/i18n/locales/{vi,en,zh}/translation.json`.
4. `npm run lint && npm run build`.

## 8. Quy trình sửa code

```bash
# trước khi sửa
cd server && npm run smoke

# sau khi sửa backend
cd server && npm run smoke
npm run dev            # terminal khác
npm run test:contract

# sau khi sửa frontend
cd client && npm run lint && npm run build
# rồi KIỂM TRA BẰNG TAY — xem docs/testing.md mục 5.1
```

Nếu có di chuyển file: chạy thêm hai lệnh grep kiểm tra quy tắc phụ thuộc trong
[testing.md](testing.md) mục 4.

## 9. Lỗi thường gặp

| Hiện tượng | Nguyên nhân |
|---|---|
| `Missing required environment variable(s)` rồi thoát | chưa `cp .env.example .env` hoặc thiếu biến |
| `Port 5000 đang được process khác dùng` | một server cũ còn chạy — tắt nó hoặc đổi `PORT` |
| `test:security`/`test:contract` báo 429 | chạm `loginLimiter`; chờ 1 phút, hoặc chạy server dev với `LOGIN_RATE_LIMIT_MAX` lớn hơn |
| `ERR_INVALID_PACKAGE_TARGET` | thêm alias vào `imports` trỏ ra ngoài thư mục package — Node không cho, xem [folder-structure.md](folder-structure.md) |
| `Cannot find module '#core/...'` | sai alias, hoặc file không có đuôi `.js` khớp pattern `./core/*.js` |
| `duplicate column` khi migrate | DB dựng từ `schema.sql` nhưng chưa chạy `--baseline` |
| Client gọi API bị CORS | `CLIENT_ORIGIN` không khớp origin thật của client |
| `ERR_SIGNATURE_MISSING` trên request ghi | client chưa có `signingKey` (chưa login), hoặc route mới bị thiếu/thừa trong `UNSIGNED_URLS` |
| Phiên bị đăng xuất sau 15 phút | nhánh refresh trong `axiosClient.js` lỗi — kiểm tra cookie `refreshToken` có được gửi kèm (`withCredentials`) |
| Build client pass nhưng app trắng trang | khả năng cao sai thứ tự Provider — `ToastProvider` phải bọc ngoài `AuthProvider` |

## 10. Đọc gì tiếp

| Tài liệu | Khi nào |
|---|---|
| [architecture.md](architecture.md) | lần đầu vào repo |
| [folder-structure.md](folder-structure.md) | tìm file, hiểu alias |
| [dependency-rules.md](dependency-rules.md) | trước khi thêm import giữa các module |
| [coding-conventions.md](coding-conventions.md) | trước khi viết code mới |
| [api-conventions.md](api-conventions.md) | trước khi đổi response hay thêm endpoint |
| [database-conventions.md](database-conventions.md) | trước khi đổi schema hay viết migration |
| [security.md](security.md) | trước khi chạm vào auth, token, rate limit |
| [testing.md](testing.md) | trước khi báo cáo "đã test" |
