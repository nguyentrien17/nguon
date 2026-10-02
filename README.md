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

- [docs/architecture.md](docs/architecture.md) — Core/Features/Shared là gì, luồng một request
- [docs/folder-structure.md](docs/folder-structure.md) — file nào ở đâu, alias `#core/*`/`#features/*`
- [docs/dependency-rules.md](docs/dependency-rules.md) — module nào được import module nào
- [docs/api-conventions.md](docs/api-conventions.md) — format response, cách phát sinh lỗi

## Yêu cầu

- Node.js 18+
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

### 4. Root package

`package.json` ở thư mục gốc chỉ cung cấp `node_modules` (zod) cho `shared/validators` — không chứa code chạy trực tiếp, không cần chạy gì ở đây ngoài `npm install`.

## Ghi chú vận hành

- `GET /health` — health check.
- Server tự đóng connection pool DB khi nhận `SIGTERM`/`SIGINT` (graceful shutdown).
- Quên mật khẩu (`/forgot-password`): chưa cấu hình SMTP/email provider thật — link reset hiện chỉ được log ra console server (`server/core/mailer.js`). Cần thay bằng provider thật (SendGrid/SES/SMTP...) trước khi dùng production.
- `npm run audit` (root/client/server) chạy `npm audit --omit=dev`.
- `LOG_LEVEL` (`error`/`warn`/`info`/`debug`) điều chỉnh độ chi tiết của application log; mặc định `debug` ở development, `info` ở production.
- Test tự động hiện chỉ có `server`: `npm run smoke`. Chưa có unit/integration test, chưa có CI, chưa có Dockerfile — cần bổ sung nếu deploy production.
