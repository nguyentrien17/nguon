# Quy ước viết code

Quy ước này mô tả cách code trong repo **đang** được viết. Viết thêm thì theo khuôn này, đừng
mang style khác vào.

## 1. Ngôn ngữ và định dạng

- **JavaScript, không TypeScript.** Backend CommonJS (`require`), frontend ESM (`import`).
  `shared/` là ESM (`export const ...`, import nội bộ phải ghi đuôi `.js`); backend vẫn
  `require('../../../shared/validators/x')` bình thường nhờ `require(esm)` của Node. **Không**
  dùng top-level `await` trong `shared/` — `require(esm)` không nạp được module như vậy.
- Thụt lề **4 space**. Nháy đơn cho chuỗi. Có dấu `;` cuối câu.
  Ngoại lệ còn sót: `client/src/main.jsx` và `client/vite.config.js` dùng 2 space và không có
  `;` — là file sinh từ template `create-vite`, chưa ai chỉnh. Đừng lấy chúng làm mẫu.
- Dòng dài khoảng **120 ký tự**.
- Chỉ `client/` có eslint (`npm run lint`), và **config hiện tại không có rule về indent hay
  quote** — nên style là quy ước thủ công, không được máy cưỡng chế. Server chưa có lint.

## 2. Comment

Đây là đặc trưng rõ nhất của repo này và cần giữ: **comment giải thích "tại sao", không giải
thích "cái gì"**. Code đã nói nó làm gì rồi.

Comment tốt (có thật trong repo):

```js
// Hash "giả" dùng để chạy bcrypt.compare khi username không tồn tại, để thời gian phản hồi
// tương đương trường hợp sai password — tránh lộ username hợp lệ qua timing (bcrypt.compare
// tốn vài chục ms, trong khi trả lỗi ngay gần như tức thời).
const DUMMY_PASSWORD_HASH = '$2a$12$...';
```

Comment vô ích — đừng viết:

```js
// Hash mật khẩu
const passwordHash = await bcrypt.hash(password, 12);
```

Bắt buộc có comment "tại sao" khi:

- Code **cố ý** làm một việc trông như sai (dòng `bcrypt.compare` vô nghĩa ở trên).
- Có một **đánh đổi** đã được cân nhắc (URL không đưa vào chuỗi ký).
- Có **giới hạn** mà người đọc sau dễ hiểu sai (threat model của `verifySignature`).
- Một thứ phải **khớp với nơi khác** (`UNSIGNED_URLS` ↔ route backend).

Comment viết tiếng Việt là bình thường trong repo này; một số comment cũ bằng tiếng Anh cũng
được giữ. Đừng dịch lại hàng loạt.

## 3. Backend: trách nhiệm từng lớp

```
Routes      → mount endpoint, xếp middleware. Không có logic.
Controller  → đọc req, gọi service, trả res. KHÔNG có SQL, KHÔNG có nghiệp vụ.
Service     → use case, kiểm tra nghiệp vụ, điều phối model, ghi audit log.
              KHÔNG chạm vào req/res.
Model       → truy cập dữ liệu (knex). KHÔNG có quy tắc nghiệp vụ.
Validators  → re-export schema từ shared/validators.
```

### Controller

Luôn bọc `asyncHandler`. Nhiệm vụ duy nhất là dịch HTTP ↔ tham số service:

```js
const listUsers = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const result = await userService.listUsers({ page, limit, search: req.query.search });
    return res.json({ success: true, ...result });
});
```

**Clamp mọi giá trị số từ query ở cả hai biên.** Chỉ chặn biên trên là đủ để
`?limit=-5` xuống tới `limit(-5)` của knex và ném lỗi driver → 500 thay vì 400.

Ngữ cảnh actor được truyền xuống service tường minh, không truyền cả `req`:

```js
await userService.updateUser(req.params.id, { email, full_name, actorId: req.user.id, ip: req.ip });
```

### Service

- Nhận và trả **object thuần**, không biết gì về HTTP.
- Phát sinh lỗi bằng `throw new AppError(status, ERROR_CODE.X, 'fallback tiếng Anh')`.
- Tự ghi audit log qua `auditLogModel.create`. Hàm này **tự nuốt lỗi**, không bao giờ throw —
  lỗi ghi log không làm vỡ request.
- Khi nhiều bước ghi phải cùng thành/cùng thất bại, dùng `db.transaction`
  (`permissionModel.updatePermission`, `moduleModel` làm mẫu).

Bắt lỗi trùng dữ liệu đúng phạm vi — **bọc hẹp quanh đúng câu lệnh có thể gây trùng**, không
bọc cả khối:

```js
// Đúng: biết chắc 409 này đến từ bảng nào
try {
    id = await userModel.create({ ... });
} catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, ERROR_CODE.DUPLICATE, 'Username or email already exists');
    throw err;
}
```

### Model

- Tạo bằng `baseRepository('tên_bảng')`, chỉ viết thêm hàm đặc thù (join, order, transaction).
- `select` **cột tường minh** cho mọi hàm trả dữ liệu ra ngoài — đừng `select *` rồi mong
  controller lọc. Cột `password` không được lọt ra ngoài.
- Hàm `update` lọc qua whitelist `UPDATABLE_FIELDS` — chặn mass-assignment.

## 4. Frontend

- Component một file, export default, tên file trùng tên component (`Users.jsx` → `Users`).
- Context đi kèm một hook `useX()` throw khi dùng ngoài Provider:
  ```js
  export function useAuth() {
      const ctx = useContext(AuthContext);
      if (!ctx) throw new Error('useAuth must be used within AuthProvider');
      return ctx;
  }
  ```
- **Mọi import cắt qua ranh giới thư mục dùng `@/`.** Chỉ dùng `./` trong cùng thư mục.
- Trang được lazy-load trong `app/router/AppRoutes.jsx` để chia chunk theo route. Thêm trang
  mới thì thêm vào đó theo đúng khuôn `lazy(() => import('@/features/.../X'))`.
- Lỗi từ API hiển thị qua `getErrorMessage(err, t)` — ưu tiên `message` backend trả về (đã
  đúng ngôn ngữ), chỉ fallback sang bảng dịch client khi không có response.
- Lỗi zod phía client hiển thị qua `getZodErrorMessage` (form dùng `<Form>` thì đã tự xử lý).

### Cách chia file trong một feature

Mẫu: `features/users/`.

```
features/users/
├── Users.jsx            TRANG: header, bộ lọc, bảng, phân trang, thao tác trên dòng
├── UserFormModal.jsx    FORM tạo/sửa trong hộp thoại: khai báo trường, chọn schema, lưu
├── UserRolesModal.jsx   hộp thoại phụ khác (mỗi hộp thoại một file)
└── userApi.js           MỌI lời gọi API của feature
```

- **Component không gọi `axiosClient` trực tiếp** — gọi hàm trong `<feature>Api.js`. Mỗi hàm
  trả về `res.data` (đúng shape API: `{ data, pagination }`...), lỗi ném nguyên vẹn để caller
  hiển thị qua `getErrorMessage`. Đổi endpoint chỉ phải sửa một chỗ.
- **Trang danh sách không chứa form.** Form tạo/sửa là component riêng nhận
  `{ open, <bản ghi> | null, onClose, onSaved }`; trang chỉ giữ state "đang mở form cho bản
  ghi nào" và gọi `list.reload()` trong `onSaved`.
- Form tự tải dữ liệu phụ nó cần (vd danh sách role) **khi mở**, không bắt trang tải sẵn.
- Endpoint thuộc backend feature khác nhưng feature này cần (vd `/permissions/:id/assign` từ
  màn Users, `/modules` từ màn Permissions) khai lại trong api của feature này — **không import
  chéo** `features/a` → `features/b`. Lặp lại một hàm GET một dòng ở hai feature là chấp nhận
  được; tách chung chỉ khi có logic thật.
- Logic thuần (không React, không gọi API) mà **nhiều feature** cần (vd dựng cây
  module/action — `lib/moduleTree.js`) hoặc tiện ích không thuộc feature nào (vd
  `downloadFile`) đặt ở `lib/`.
- Logic thuần **của riêng một feature** (lọc cây, tính quyền...) tách thành file `.js` trong
  feature (vd `permissionTree.js`, `moduleFilter.js`) để component chỉ còn phần hiển thị và để
  test được không cần DOM.
- Component lớn được chia theo vai trò, không theo số dòng: trang (state + nối các phần), bảng/
  cây hiển thị, từng hộp thoại form, panel phụ. Xem `features/module-actions/` và
  `features/permissions/`.
- Form tạo/sửa trong hộp thoại dùng `<FormModal>`; form nhiều tab hoặc bố cục đặc biệt dùng
  `useForm` + `<Field>` (vd `RoleFormModal`).
- Trang chưa đăng nhập (`features/auth/`) dùng chung khung `AuthLayout` và giữ giao diện riêng
  (ô nhập có icon), không dùng `<Form>`.

Hiện trạng: **mọi** component trong `features/` đã gọi API qua `<feature>Api.js` — chỉ còn
`core/auth/AuthContext.jsx` và `core/api/axiosClient.js` (hạ tầng phiên) dùng `axiosClient`
trực tiếp.

## 5. Validation

Schema **sống ở `shared/validators/`** để client và server dùng cùng một định nghĩa. File
`features/*/..Validators.js` ở server chỉ re-export:

```js
module.exports = require('../../../shared/validators/userValidators');
```

Message trong schema là **khoá dịch**, không phải câu tiếng Anh:

```js
z.string().min(8, 'validation.tooShort')
```

### Viết schema mới — không chép lại quy tắc

1. **Dùng "viên gạch" trong `shared/validators/fields.js`** thay vì viết lại chuỗi
   `z.string().trim()...`: `requiredName`, `optionalText(max)`, `upperCode`, `lowerCode`,
   `email`, `positiveId`, `optionalId`, `recordStatus`, `atLeastOneField(schema)`. Mỗi quy tắc
   chỉ định nghĩa một lần, luôn kèm key dịch. Cần quy tắc mới dùng ở ≥ 2 schema thì thêm vào
   `fields.js`; quy tắc chỉ một nơi dùng thì viết tại chỗ.
2. **Suy schema cập nhật từ schema tạo mới** bằng `.pick` / `.omit` / `.partial` / `.extend`,
   không chép lại từng trường:
   ```js
   export const updateModuleSchema = createModuleSchema
       .omit({ module_code: true, module_parent_id: true })   // không cho đổi
       .extend({ status: recordStatus.optional() });            // chỉ khi cập nhật mới có
   export const updateUserSchema = atLeastOneField(
       createUserSchema.pick({ email: true, full_name: true }).partial().extend({ ... })
   );
   ```
   Thêm trường vào schema tạo mới thì schema cập nhật tự có theo (trừ khi bị `omit`).
3. `.pick` / `.omit` / `.extend` chỉ dùng được **trước** `.refine(...)` — vì vậy
   `atLeastOneField` bọc ở ngoài cùng.
4. Import nội bộ trong `shared/` phải ghi đuôi `.js` (`from './fields.js'`) — `shared/` là ESM.

### Từ issue zod tới thông báo

`shared/validators/issueKey.js` (`zodIssueKey`) đổi một issue zod thành key `validation.*` —
**dùng chung** cho `validateBody` ở server và form ở client. Nó lo cả các lỗi zod tự sinh câu
tiếng Anh (sai kiểu: gửi `null` / số thay vì chuỗi, thiếu trường, số ngoài khoảng...), nên dù
schema có quên message thì người dùng vẫn không thấy câu tiếng Anh. Test chặn hồi quy:
`server/tests/unit/validate.test.js` ("mọi lỗi validate đều ra key dịch").

`validateBody` lấy issue đầu tiên, đổi qua `zodIssueKey` thành `params.reasonKey`, để
`errorHandler` tra bản dịch theo `X-Locale`.

**Validator không thay cho kiểm tra quyền hay quy tắc nghiệp vụ.** `createUserSchema` xác nhận
`role_ids` là mảng số nguyên dương; việc actor *có được phép* gán role hay không thuộc
`userService.assertCanAssignRoles`.

## 6. Hằng số

Giá trị dùng ở cả hai phía đặt trong `shared/constants.json`: `ERROR_CODE`, `MODULE_CODE`,
`ACTION_CODE`, `USER_STATUS`, `RECORD_STATUS`, `AUDIT_ACTION`, `AUDIT_STATUS`, `API_PREFIX`,
`DEFAULT_SERVER_PORT`, `PROTECTED_ROLE_CODE`.

Không hard-code chuỗi `'MOD_USER'` hay số `1` cho status trong code — import hằng.

Hằng chỉ dùng trong một module thì để ngay đầu module đó (`MAX_FAILED_ATTEMPTS`,
`LOCK_DURATION_MS` trong `authService.js`).

## 7. Đặt tên

| | Quy ước |
|---|---|
| File backend | camelCase theo feature: `userService.js`, `permissionMiddleware.js` |
| File component | PascalCase: `UserRolesModal.jsx` |
| Hàm, biến | camelCase |
| Hằng module-level | UPPER_SNAKE_CASE |
| Trường trong DB và payload API | snake_case (`full_name`, `module_code`) |
| Biến trong JS | camelCase (`actorId`, `passwordHash`) |

Ranh giới snake_case ↔ camelCase là **payload API**: `full_name` giữ nguyên snake_case khi đi
qua HTTP và DB; biến nội bộ dùng camelCase. Không có lớp tự động chuyển đổi — đừng thêm.

## 8. Những gì đừng làm

- Đừng gọi `res.json` trong service.
- Đừng viết SQL trong controller.
- Đừng đọc `process.env` ngoài `server/core/config/env.js`.
- Đừng dùng `console.log` trong code ứng dụng — dùng `logger` (script CLI thì được).
- Đừng để Core import Feature (xem [dependency-rules.md](dependency-rules.md)).
- Đừng thêm thư viện khi đã có cách tương đương trong repo.
- Đừng đổi format response API mà không đọc [api-conventions.md](api-conventions.md).
