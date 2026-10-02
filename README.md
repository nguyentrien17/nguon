# RBAC Portal

Hệ thống quản lý người dùng / phân quyền (RBAC): users, roles (permissions), modules, actions, audit log.

## Cấu trúc

```
client/   React + Vite SPA
server/   Express API (feature-based: controller-service-model-routes-validators)
shared/   Validator (zod) + constants dùng chung giữa client và server
```

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
- Quên mật khẩu (`/forgot-password`): chưa cấu hình SMTP/email provider thật — link reset hiện chỉ được log ra console server (`server/utils/mailer.js`). Cần thay bằng provider thật (SendGrid/SES/SMTP...) trước khi dùng production.
- `npm run audit` (root/client/server) chạy `npm audit --omit=dev`.
- Chưa có test tự động, CI, hay Dockerfile — cần bổ sung nếu deploy production.
