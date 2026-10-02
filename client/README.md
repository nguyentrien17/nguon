# Client (RBAC Portal)

React 19 + Vite SPA cho hệ thống quản lý người dùng / phân quyền. Xem [README ở root](../README.md) để chạy toàn bộ dự án (server + DB).

## Lệnh

```bash
npm install
npm run dev       # http://localhost:5173, cần server chạy sẵn ở http://localhost:5000
npm run build      # build production vào dist/
npm run preview    # xem thử bản build
npm run lint
```

## Cấu hình

- `VITE_API_URL` (tuỳ chọn, `.env` hoặc biến môi trường khi build) — override base URL gọi API, mặc định `http://localhost:5000/api`.

## Cấu trúc

```
src/
  api/           axios client (interceptor gắn access token, tự refresh khi hết hạn, ký request)
  components/    component dùng chung (Sidebar, Layout, ProtectedRoute, ActionGuard...)
  context/       AuthContext (phiên đăng nhập), ToastContext
  i18n/          bản dịch vi/en/zh
  pages/         1 thư mục / 1 domain (users, permissions, audit-logs, module-actions...)
  utils/         helper hiển thị lỗi, ký request, đọc lỗi zod
```

Import `@/...` trỏ vào `src/`, `@shared/...` trỏ vào `../shared/` (validator zod + constants dùng chung với server) — xem `vite.config.js`/`jsconfig.json`.
