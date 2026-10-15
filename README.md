# RBAC Portal

Hệ thống quản lý người dùng / phân quyền (RBAC): users, roles (permissions), modules, actions, audit log.

## Cấu trúc

```
client/   React + Vite SPA
          ├── app/       khởi tạo ứng dụng (App, router, providers, layout)
          ├── core/      hạ tầng FE (api, auth, permissions, errors)
          └── features/  nghiệp vụ theo trang
server/   Express API
          ├── core/      hạ tầng kỹ thuật, không chứa nghiệp vụ (config, db, errors, http, security)
          └── features/  nghiệp vụ (controller-service-model-routes-validators)
shared/   Validator (zod) + constants dùng chung giữa client và server
docs/     Tài liệu kiến trúc
tailieu/  Tài liệu đầu vào của dự án (SRS, kế hoạch refactor)
```

Trước khi sửa code, đọc:

- [docs/development-guide.md](docs/development-guide.md) — cài đặt, script, biến môi trường, lỗi thường gặp
- [docs/architecture.md](docs/architecture.md) — Core/Features/Shared là gì, luồng một request
- [docs/folder-structure.md](docs/folder-structure.md) — file nào ở đâu, alias `#core/*`/`#features/*`
- [docs/dependency-rules.md](docs/dependency-rules.md) — module nào được import module nào
- [docs/coding-conventions.md](docs/coding-conventions.md) — trách nhiệm từng lớp, quy ước đặt tên
- [docs/api-conventions.md](docs/api-conventions.md) — format response, cách phát sinh lỗi
- [docs/database-conventions.md](docs/database-conventions.md) — schema, migration, vấn đề đã biết
- [docs/security.md](docs/security.md) — cơ chế bảo vệ đang có và giới hạn của chúng
- [docs/testing.md](docs/testing.md) — test nào có, test nào **chưa** có

## Yêu cầu

- Node.js `^20.19.0 || >=22.12.0` (Vite 8 yêu cầu; `.nvmrc` = 22)
- MySQL 8+

## Cài đặt & chạy

### 1. Database

```bash
mysql -u root -p < server/database/schema.sql
mysql -u root -p rbac_portal < server/database/seed.sql
```

Tài khoản mặc định sau seed: `superadmin` / `Admin@123`.

Nếu có thêm migration mới trong `server/database/migrations/`, chạy:

```bash
cd server
npm run migrate
```

(Migration đã theo dõi trạng thái trong bảng `schema_migrations`, chạy lại nhiều lần vẫn an toàn.)

### 2. Server

```bash
cd server
npm install
cp .env.example .env   # rồi điền DB_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET thật
npm run dev             # http://localhost:5000
```

Biến môi trường bắt buộc: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — thiếu biến nào server sẽ báo lỗi và dừng ngay lúc khởi động.

Khi deploy production **phải** đặt `NODE_ENV=production`: cờ `Secure` của cookie refresh token phụ thuộc vào biến này. Thiếu nó server chỉ cảnh báo chứ không dừng, nên rất dễ bị bỏ qua.

Kiểm tra nhanh sau khi cài (không cần MySQL đang chạy):

```bash
cd server
npm run smoke     # load toàn bộ import graph, bắt lỗi đường dẫn require/alias
```

### 3. Client

```bash
cd client
npm install
npm run dev              # http://localhost:5173
```

Build production: đặt `VITE_API_URL` (xem `client/.env.example`) **trước** `npm run build` — giá trị được nhúng cứng vào bundle.

### 4. Root package

`package.json` ở thư mục gốc chỉ cung cấp `node_modules` (zod) cho `shared/validators` — không chứa code chạy trực tiếp, không cần chạy gì ở đây ngoài `npm install`.

## Ghi chú vận hành

- `GET /health` — liveness (process còn sống, không chạm DB). `GET /health/ready` — readiness (kiểm tra kết nối DB, trả 503 khi DB không dùng được).
- Chạy sau reverse proxy (nginx/Cloudflare...) thì đặt `TRUST_PROXY=true` — mặc định là `false`, xem [docs/security.md](docs/security.md) mục 3.
- Server tự đóng connection pool DB khi nhận `SIGTERM`/`SIGINT` (graceful shutdown, tối đa 10 giây rồi thoát cưỡng bức). Lỗi không bắt được (`unhandledRejection`/`uncaughtException`) được log rồi tắt server có kiểm soát để orchestrator khởi động lại.
- Quên mật khẩu (`/forgot-password`): chưa cấu hình SMTP/email provider thật — link reset hiện chỉ được log ra console server (`server/core/mailer.js`). Cần thay bằng provider thật (SendGrid/SES/SMTP...) trước khi dùng production.
- `npm run audit` (root/client/server) chạy `npm audit --omit=dev`.
- `LOG_LEVEL` (`error`/`warn`/`info`/`debug`) điều chỉnh độ chi tiết của application log; mặc định `debug` ở development, `info` ở production.
- Kiểm tra tự động (đều ở `server/`): `npm run lint`, `npm test` (unit, không cần DB), `npm run smoke` (không cần DB), `npm run test:contract` và `npm run test:security` (cần server đang chạy + MySQL). Chưa có test UI, chưa có CI, chưa có Dockerfile — xem [docs/testing.md](docs/testing.md).
- Server dùng `overrides` trong `package.json` để ép `uuid` (phụ thuộc gián tiếp của `exceljs`) lên `11.1.1` — bản `8.x` mà `exceljs` kéo về có lỗ hổng. Khi nâng `exceljs`, kiểm tra lại xem còn cần override không.
