# Quy ước API

## 1. Quyết định: giữ format hiện tại

Tài liệu refactor (`tailieu/refactor-application-starter.md`, mục 9) nêu một format **ví dụ**
dùng `data` + `meta` và bọc lỗi trong `error: { code, message, details }`. Source này
**không** theo format đó. Quyết định là giữ nguyên format đang chạy, vì:

1. Format hiện tại đã nhất quán ở **cả 28 chỗ trả response** trong 7 controller — không có
   chỗ nào lệch cần dọn.
2. Đổi `pagination` → `meta` làm vỡ 3 trang client đang đọc `data.pagination`
   (`Users.jsx`, `AuditLogs.jsx`, `Dashboard.jsx`).
3. Đổi `errorCode` → `error.code` làm vỡ `client/src/utils/errorMessage.js` **và** nhánh
   tự động refresh token trong `axiosClient.js` — lỗi chỉ lộ ra sau 15 phút sử dụng, rất
   dễ lọt qua test tay.
4. Format hiện tại có **i18n thông báo lỗi** theo header `X-Locale` mà format ví dụ không
   có. Đổi sang format ví dụ là bước lùi về tính năng.

Mục 9 của tài liệu refactor yêu cầu "không âm thầm phá vỡ client hiện tại"; giữ nguyên là
cách tuân thủ yêu cầu đó. Nếu sau này vẫn muốn chuyển sang format kiểu `meta`/`error`, hãy
làm thành một đợt riêng có kiểm thử luồng refresh token, không ghép vào refactor cấu trúc.

## 2. Response thành công

Một đối tượng:

```json
{ "success": true, "data": { "id": 7, "username": "lan" } }
```

Danh sách có phân trang — khoá là **`pagination`**, không phải `meta`:

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 100, "totalPages": 10 }
}
```

Hành động không có gì để trả về:

```json
{ "success": true }
```

**Ngoại lệ đã có:** `POST /api/auth/login` và `POST /api/auth/refresh` trả
`accessToken`, `signingKey`, `user`, `permissions` **ngang cấp với `success`**, không bọc
trong `data`. Đây là lệch chuẩn có sẵn từ trước; client đang đọc đúng như vậy. Đừng "sửa
cho đẹp" nếu không sửa client trong cùng commit.

## 3. Response lỗi

```json
{ "success": false, "errorCode": "ERR_VALIDATION", "message": "email: validation.invalidFormat" }
```

- `errorCode` — hằng trong `shared/constants.json → ERROR_CODE`. Client phân nhánh theo
  khoá này, **không** theo `message`.
- `message` — đã được dịch sang ngôn ngữ client yêu cầu qua header `X-Locale`
  (`vi` | `en` | `zh`, mặc định `en`), tra từ `shared/errorMessages.json`.
- Không có `details`. Lỗi validate trả **vấn đề đầu tiên** tìm thấy, ở dạng
  `"<field>: <reasonKey>"`.

HTTP status đang dùng:

| Status | Khi nào |
|---|---|
| 400 | validate thất bại, chữ ký thiếu/sai/hết hạn, mật khẩu hiện tại sai, token reset không hợp lệ |
| 401 | thiếu/sai access token, sai thông tin đăng nhập, refresh token không hợp lệ |
| 403 | thiếu quyền, tài khoản bị vô hiệu hoá, tự khoá chính mình |
| 404 | không tìm thấy bản ghi hoặc endpoint |
| 409 | trùng dữ liệu (`ER_DUP_ENTRY`) |
| 423 | tài khoản đang bị khoá tạm do đăng nhập sai nhiều lần |
| 429 | vượt rate limit |
| 500 | lỗi không lường trước |

## 4. Cách phát sinh lỗi trong code

Luôn dùng `AppError`, không bao giờ tự `res.status(...).json(...)` trong service:

```js
const AppError = require('#core/errors/AppError');
const { ERROR_CODE } = require('#shared');

throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
```

Tham số thứ 3 là message **fallback tiếng Anh**, chỉ dùng khi `shared/errorMessages.json`
không có bản dịch cho mã đó. Tham số thứ 4 (`params`) dùng cho interpolation `{{key}}`
trong bản dịch.

Mọi controller bọc trong `asyncHandler` để lỗi async đi đúng vào `errorHandler`:

```js
const listUsers = asyncHandler(async (req, res) => { ... });
```

`errorHandler` (`core/errors/errorHandler.js`) là **điểm duy nhất** biến lỗi thành response.
Lỗi không phải `AppError` được log kèm method/url/user rồi trả 500 với thông báo chung —
stack trace không bao giờ ra tới client.

## 5. Quy ước đặt endpoint

```
/api/<tài-nguyên-số-nhiều>
/api/<tài-nguyên>/:id
/api/<tài-nguyên>/:id/<tài-nguyên-con>
```

Tiền tố `/api` lấy từ `API_PREFIX` trong `shared/constants.json`, dùng chung với client —
đổi ở một nơi.

**Lệch chuẩn đã có:** `DELETE /api/users/:id` thực chất là **khoá/mở khoá** tài khoản, không
xoá, và cả hai chiều đều đòi quyền `MOD_USER:delete`. Ghi ở đây để không ai tưởng là xoá.
Nên chuyển thành `PATCH /api/users/:id/status` ở một đợt có sửa client kèm theo.

## 6. Thứ tự middleware trên một route

Thứ tự này có ý nghĩa, đừng xáo:

```js
router.post('/',
    authenticate,                                        // 1. bạn là ai
    requirePermission(MODULE_CODE.USER, ACTION_CODE.CREATE), // 2. bạn được phép không
    verifySignature,                                     // 3. request có bị sửa không (cần req.user.sigKey)
    validateBody(createUserSchema),                      // 4. dữ liệu có hợp lệ không
    createUser);                                         // 5. xử lý
```

- `verifySignature` **phải** sau `authenticate` vì nó dùng `req.user.sigKey`.
- Chỉ các method thay đổi dữ liệu (POST/PUT/PATCH/DELETE) cần `verifySignature`; GET không.
- Các endpoint auth công khai (login, refresh, logout, forgot/reset password) không ký —
  danh sách tương ứng ở `UNSIGNED_URLS` trong `client/src/api/axiosClient.js`. Sửa một bên
  thì phải sửa bên kia.
