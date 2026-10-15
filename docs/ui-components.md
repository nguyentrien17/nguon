# Component giao diện dùng chung

Bộ component trong `client/src/components/ui/` và hook trong `client/src/hooks/`. Khi viết một
trang mới, **dùng các component này thay vì tự dựng lại** `<table>`, phân trang, modal hay
nút có spinner.

```jsx
import { Button, DataTable, Pagination, Modal } from '@/components/ui';
import usePagedList from '@/hooks/usePagedList';
import { useToast } from '@/app/providers/ToastContext';
```

Trang mẫu đã chuyển sang bộ component này: `features/users/Users.jsx` (danh sách + tìm kiếm +
modal form + xác nhận) và `features/audit-logs/AuditLogs.jsx` (danh sách + bộ lọc select).

## 1. Chọn component nào

| Cần | Dùng |
|---|---|
| Báo kết quả một thao tác ("Đã lưu"), lỗi API | `toast.success/error/warning/info` |
| Thông báo phải nằm lại trên trang (lỗi form, cảnh báo trước thao tác) | `<Alert>` |
| Hỏi có/không trước khi làm | `<ConfirmDialog>` |
| Form hoặc nội dung trong hộp thoại | `<Modal>` |
| Nút có chữ | `<Button>` |
| Nút chỉ có icon (thao tác trên dòng) | `<IconButton>` |
| Nhãn trạng thái | `<Badge>` |
| Danh sách dạng bảng có phân trang | `usePagedList` + `<SearchBar>` + `<DataTable>` + `<Pagination>` |
| Không có dữ liệu (ngoài bảng) | `<EmptyState>` |
| Form nhập liệu theo danh sách trường | `<Form fields={[...]} schema={...} onSubmit={...}>` (mục 6) |
| Form tạo/sửa trong hộp thoại | `<FormModal>` (mục 6.1) |
| Nhiều tab trong một hộp thoại / trang | `<Tabs>` |
| Ô tích "chọn tất cả" của một nhóm (3 trạng thái) | `<TriStateCheckbox>` |
| Một trường lẻ (nhãn + ô + lỗi) | `<Field type="...">` |
| Ô nhập / dropdown / ô tích / chọn file lẻ | `Input`, `Textarea`, `Select`, `Checkbox`, `CheckboxGroup`, `FileInput` |

## 2. Thông báo

### Toast — `useToast()`

```jsx
const toast = useToast();
toast.success(t('users.updated'));
toast.error(getErrorMessage(err, t));   // luôn dịch lỗi API qua getErrorMessage
toast.warning(msg);                     // 5s
toast.info(msg, 0);                     // 0 = không tự ẩn
const id = toast.info(msg); toast.dismiss(id);
```

- Thời gian mặc định: success/info 3,5s, warning 5s, error 6s.
- Tối đa 5 toast cùng lúc; toast cũ nhất bị bỏ khi vượt.
- Object `toast` **giữ nguyên tham chiếu** giữa các lần render — đưa vào deps của
  `useEffect`/`useCallback` không gây chạy lại.
- **Không truyền chuỗi tiếng Anh cứng** — luôn qua `t(...)`.

### Alert

```jsx
<Alert tone="error" title={t('...')}>{message}</Alert>
<Alert tone="warning" onDismiss={() => setShow(false)}>...</Alert>
```

`tone`: `info` | `success` | `warning` | `error`. `error`/`warning` có `role="alert"` (trình
đọc màn hình đọc ngay).

### ConfirmDialog

```jsx
<ConfirmDialog
    open={!!target}
    title={t('users.lock')}
    message={`${t('users.lock')} "${target?.full_name}"?`}
    tone="danger"              // nút xác nhận màu đỏ
    loading={working}          // khoá nút + chặn đóng khi đang chạy
    onConfirm={doIt}
    onCancel={() => setTarget(null)}
/>
```

Nhãn nút mặc định là `common.confirm` / `common.cancel`. Bấm Escape hoặc bấm ra ngoài = Huỷ
(trừ khi `loading`).

## 3. Nút

```jsx
<Button variant="primary" icon={Plus} onClick={openCreate}>{t('users.create')}</Button>
<Button type="submit" variant="primary" loading={saving}>{t('common.save')}</Button>
<Button size="sm" variant="ghost">...</Button>

<IconButton icon={Pencil} label={t('users.edit')} onClick={() => openEdit(row)} />
<IconButton icon={Lock} label={t('users.lock')} tone="danger" onClick={...} />
```

- `variant`: `primary` | `secondary` (mặc định) | `danger` | `ghost`. `size`: `md` | `sm`.
- `loading` tự hiện spinner và disable — đừng ghép tay `{saving && <Spinner/>}`.
- `type` mặc định là `"button"` (khác thẻ `<button>` gốc mặc định `"submit"`), nên nút đặt
  trong form không vô tình submit. Nút submit phải ghi rõ `type="submit"`.
- `IconButton` **bắt buộc** có `label`: vừa là tooltip vừa là `aria-label`.
- Nút cần quyền thì bọc trong `<ActionGuard>` như trước — component không tự kiểm tra quyền,
  và **ẩn nút không phải biện pháp bảo mật** (xem [security.md](security.md) mục 2).

## 4. Danh sách

### `usePagedList(fetchPage, options)`

```jsx
const list = usePagedList(
    (params) => axiosClient.get('/users', { params }).then((res) => res.data),
    { limit: 10, initialFilters: { search: '' } }
);
```

- `fetchPage(params)` nhận `{ page, limit, ...filters }` (filter rỗng đã bị bỏ) và trả về
  **đúng shape API**: `{ data, pagination }` ([api-conventions.md](api-conventions.md)).
- Trả về `{ rows, pagination, filters, loading, goToPage, applyFilters, reload }`.
- `applyFilters(patch)` gộp vào bộ lọc hiện tại và tải lại từ trang 1.
- `reload()` tải lại trang hiện tại — gọi sau khi tạo/sửa/xoá.
- Tự xử lý: lỗi → `toast.error` đã dịch; **request về muộn bị bỏ qua** (bấm trang 2 rồi 3
  thật nhanh thì response của trang 2 không ghi đè trang 3); phân trang dùng bộ lọc **đã áp
  dụng**, không dùng chữ đang gõ dở.
- `options.autoLoad: false` nếu không muốn tự tải khi mount.

### DataTable

```jsx
const columns = [
    { key: 'username', header: t('users.columns.username') },          // hiện row.username
    { key: 'status', header: t('users.columns.status'),
      render: (u) => <Badge tone={u.status === 1 ? 'success' : 'danger'}>...</Badge> },
    { key: 'actions', header: t('users.columns.actions'), className: 'actions-cell',
      render: (u) => <IconButton ... /> },
];
<DataTable columns={columns} rows={list.rows} loading={list.loading} emptyMessage={t('users.empty')} />
```

- Ô không có `render` mà giá trị `null`/`undefined`/`''` → hiện `—`.
- `rowKey` mặc định `'id'`; truyền hàm `(row) => key` nếu dữ liệu không có `id`.
- Đang tải: overlay spinner trên bảng cũ (không nháy trống). Hết tải mà rỗng: `EmptyState`.
- `columns` khai báo trong thân component (cần `t`) — không cần `useMemo` với cỡ bảng hiện tại.

### Pagination

```jsx
<Pagination pagination={list.pagination} onChange={list.goToPage} disabled={list.loading} />
```

Nhận thẳng object `pagination` của API. Chỉ hiện trang đầu, trang cuối và lân cận trang hiện
tại, có `…` ở giữa — số nút **cố định** khi bấm qua lại (trước đây render mọi số trang: 500
trang là 500 nút). Hiện tổng số bản ghi. Ẩn khi chỉ có 1 trang.

### SearchBar

```jsx
<SearchBar value={search} onChange={setSearch}
           onSearch={(value) => list.applyFilters({ search: value })}
           placeholder={t('users.search')}>
    {/* bộ lọc <select> đặt cùng hàng, tuỳ chọn */}
</SearchBar>
```

Trang chỉ có bộ lọc select (không ô tìm kiếm) thì dùng `<div className="search-bar">` trực
tiếp — xem `AuditLogs.jsx`.

## 5. Modal

```jsx
<Modal open={formOpen} title={t('users.create')} onClose={close} busy={saving}
       as="form" onSubmit={handleSave} size="wide"
       footer={<>
           <Button onClick={close} disabled={saving}>{t('common.cancel')}</Button>
           <Button type="submit" variant="primary" loading={saving}>{t('common.save')}</Button>
       </>}>
    <div className="form-grid">...</div>
</Modal>
```

- Đóng bằng Escape hoặc bấm ra ngoài — **trừ khi `busy`**, để không mất dữ liệu khi đang lưu.
- `as="form"`: hộp thoại là `<form>`, Enter trong ô nhập sẽ submit.
- `size="wide"`: 680px.

## 6. Form

Nằm ở `client/src/components/form/`, import gộp:

```jsx
import { Form, Field, Input, Select, Textarea, Checkbox, CheckboxGroup, FileInput, Label, FormField } from '@/components/form';
import useForm from '@/hooks/useForm';
```

Trang mẫu: `features/profile/Profile.jsx` (2 form, có xác nhận mật khẩu) và
`features/users/UserFormModal.jsx` (form trong Modal, trường ẩn theo chế độ, chọn nhiều role,
tải danh sách role khi mở).

### 6.1. `<Form>` — chỉ cần khai báo trường

```jsx
<Form
    fields={['email', 'full_name']}
    labelPrefix="profile.fields"          // label = t('profile.fields.email') ...
    schema={updateProfileSchema}          // zod dùng chung với server
    initialValues={{ email: user.email, full_name: user.full_name }}
    onSubmit={async (data) => {
        await axiosClient.put('/auth/me', data);
        toast.success(t('profile.updated'));
    }}
/>
```

Form tự lo: state, validate theo schema (lỗi hiện **dưới từng trường**, dịch theo ngôn ngữ
đang chọn), dấu `*` cho trường bắt buộc, focus trường lỗi đầu tiên, khoá form + spinner khi
đang gửi, toast lỗi API.

**Trường dạng chuỗi** (`'email'`): type suy từ tên — chứa `password` → ô mật khẩu, chứa
`email` → ô email, còn lại → ô chữ. **Trường dạng object** khi cần thêm cấu hình:

| Thuộc tính | Ý nghĩa |
|---|---|
| `name` | **bắt buộc** — key trong values |
| `type` | `text` `email` `password` `number` `date` `tel` `url` `textarea` `select` `checkbox` `checkboxes` `file` |
| `label` | nhãn; không có thì `t(\`${labelPrefix}.${name}\`)`, không có prefix thì dùng `name` |
| `required` | ghi đè; mặc định **suy từ schema** (trường không `.optional()` = bắt buộc) |
| `hidden` | `true` hoặc `(values) => boolean`; trường ẩn không render, không validate, **không có trong data** |
| `disabled` | khoá riêng trường này |
| `placeholder`, `hint` | chữ mờ trong ô / dòng gợi ý dưới ô |
| `span` | `2` = chiếm cả hàng khi `layout="grid"` |
| `options` | cho `select`/`checkboxes`: `[{ value, label, hint?, disabled? }]` hoặc `['A', 'B']` |
| `emptyMessage` | `checkboxes` khi không có option nào |
| `accept`, `multiple`, `maxSize` | cho `file` (`maxSize` tính bằng byte) |
| `normalize` | `(v) => v'` biến đổi giá trị khi gõ, vd `(v) => v.toUpperCase()` cho mã module |
| `render` | control tuỳ biến: `({ id, value, onChange, disabled, invalid, describedBy }) => JSX` — Form vẫn lo nhãn/lỗi (vd `IconPicker` trong `ModuleFormModal`) |
| còn lại | `autoComplete`, `rows`, `min`, `max`, `step`... chuyển thẳng xuống thẻ input |

Props của `<Form>`:

| Prop | Ý nghĩa |
|---|---|
| `fields` | danh sách trường như trên |
| `schema` | zod schema — nên dùng đúng schema ở `shared/validators` mà server dùng |
| `initialValues` | giá trị ban đầu. **Đổi `key` của `<Form>` để nạp lại** (vd mở form sửa bản ghi khác) |
| `validate(data)` | kiểm tra thêm, trả `{ tênTrường: 'lỗi', _form: 'lỗi chung' }`; chỉ chạy khi schema đã hợp lệ |
| `onSubmit(data)` | chỉ gọi khi hợp lệ. `data` đã qua schema (trim, default) và **bỏ trường trống** (`''` → không gửi). Ném lỗi → toast lỗi đã dịch |
| `layout` | `stack` (mặc định) \| `grid` (2 cột, về 1 cột trên màn hẹp) |
| `title`, `submitLabel`, `submitIcon`, `cancelLabel`, `onCancel` | tiêu đề, nhãn nút; có `onCancel` mới hiện nút Huỷ |
| `resetOnSuccess` | xoá trắng form sau khi gửi thành công (vd form đổi mật khẩu) |
| `actionsClassName` | `form-actions` (mặc định) — đặt `modal-actions` khi form nằm trong `<Modal>` |
| `className` | vd `profile-card` |
| `children` | nội dung thêm sau các trường; có thể là hàm `(form) => ...` để đọc `form.values` |

Ví dụ trường ẩn theo giá trị trường khác:

```jsx
fields={[
    { name: 'type', type: 'select', options: [{ value: 1, label: 'Menu' }, { value: 2, label: 'Màn hình' }] },
    { name: 'module_href', hidden: (values) => values.type !== 2 },
]}
```

**Form trong hộp thoại: dùng `<FormModal>`** (xem `UserFormModal.jsx`, `ModuleFormModal.jsx`):

```jsx
{editing && (
    <FormModal title={t('users.create')} onClose={close}
               layout="grid" fields={fields} schema={schema} initialValues={...}
               onSubmit={async (data) => { await api(data); close(); onSaved(); }} />
)}
```

`FormModal` = `Modal` + `Form`: nút Huỷ gọi `onClose`, và **trong lúc `onSubmit` chạy không
đóng được** bằng Escape / bấm ra ngoài. `open` mặc định `true` (hợp với render có điều kiện);
truyền `open={...}` nếu luôn render.

### 6.2. Tự dựng form tuỳ biến — `useForm` + `<Field>`

Khi bố cục không theo dạng danh sách trường (nhiều cột lồng nhau, trường xen bảng...):

```jsx
const fields = [{ name: 'email', type: 'email', label: t('...'), required: true }];
const form = useForm({ fields, schema, initialValues });

<form onSubmit={form.handleSubmit(async (data) => api(data))} noValidate>
    <Field name="email" type="email" label={t('...')} required
           value={form.values.email} onChange={(v) => form.setValue('email', v)} error={form.errors.email} />
    {form.formError && <Alert tone="error">{form.formError}</Alert>}
    <Button type="submit" variant="primary" loading={form.submitting}>{t('common.save')}</Button>
</form>
```

`useForm` trả về `{ values, errors, formError, submitting, setValue, setError, setValues, reset, handleSubmit }`.

`handleSubmit(onValid, onInvalid)` — `onInvalid({ errors, formError, firstInvalid })` tuỳ chọn,
gọi khi dữ liệu không hợp lệ; ô lỗi đầu tiên được focus **sau** `onInvalid`. Dùng cho form
nhiều tab: chuyển về tab chứa ô lỗi (xem `features/permissions/RoleFormModal.jsx` — 2 tab, một
nút Lưu, số lỗi hiện trên nhãn tab qua `<Tabs>` `badge`).

### 6.3. Control lẻ

Tất cả nhận `onChange(value)` — **giá trị, không phải event**:

| Component | `value` | Ghi chú |
|---|---|---|
| `Input` | chuỗi; `type="number"` → number hoặc `''` | |
| `Textarea` | chuỗi | |
| `Select` | đúng kiểu của `option.value` (number vẫn là number) hoặc `''` | `placeholder={false}` để bỏ dòng "-- Chọn --" |
| `Checkbox` | boolean | nhãn là `children` |
| `CheckboxGroup` | mảng | thứ tự theo `options` |
| `FileInput` | `File` \| `null`, hoặc `File[]` khi `multiple` | bấm chọn hoặc kéo thả; file sai `accept`/vượt `maxSize` bị loại và báo qua `onReject(msg)` |
| `Label`, `FormField` | — | khung nhãn/gợi ý/lỗi khi tự ghép control |

### 6.4. Lưu ý

- **Validate ở client chỉ để báo lỗi sớm**; server vẫn validate lại bằng cùng schema.
- **Thông báo lỗi** lấy từ key `validation.*` trong schema (vd `'validation.tooShort'`). Schema
  không ghi message (vd `.max(255)`) vẫn được dịch theo loại lỗi, không lọt câu tiếng Anh của zod.
- **Gửi file lên server: CHƯA dùng được với API hiện tại.**
  - Backend chưa có endpoint nhận upload (chưa có thư viện multipart như `multer`).
  - Chữ ký request trong `core/api/axiosClient.js` ký trên `JSON.stringify(body)`. Body
    `FormData` sẽ bị ký thành `'{}'`, trong khi server ký trên body rỗng → **400
    `ERR_INVALID_SIGNATURE`**.
  - Khi cần upload thật: thêm endpoint + multer ở server, và quyết định cách ký multipart (vd
    ký trên hash của file) hoặc đưa route upload vào danh sách không ký ở **cả hai phía**
    (`UNSIGNED_URLS` và route backend) — xem [security.md](security.md) mục 5.
  - `FileInput` đã sẵn sàng phía giao diện; kiểm tra `accept`/`maxSize` ở client **không**
    thay thế kiểm tra ở server.
- Style: khung `.modal-card` / `.profile-card` cũ được ưu tiên hơn style của form (để trang
  cũ trông y như trước); ngoài các khung đó dùng style trong `components/form/form.css`.

## 7. Style

- Class có sẵn (`btn-*`, `badge-*`, `data-table`, `pagination`, `modal-*`, `toast-*`) vẫn ở
  `app/App.css` — các trang chưa chuyển đổi trông y như cũ.
- Class **mới** của bộ component ở `components/ui/ui.css` (mỗi component tự import).
- Dùng biến màu ở `:root` (`--color-primary`, `--color-danger`...), không viết mã màu mới trong
  component nếu đã có biến tương ứng.

## 8. Việc còn lại

- **Mọi trang đã dùng bộ component chung**, trừ phần form của `Login`, `ForgotPassword`,
  `ResetPassword` — giữ giao diện riêng (ô nhập có icon, nút hiện/ẩn mật khẩu), chỉ dùng chung
  khung `AuthLayout`. Bảng dạng **cây** (Permissions, ModuleActions) không dùng `DataTable`
  (DataTable chỉ cho danh sách phẳng) mà tự render dòng, vẫn dùng `IconButton`, `Badge`,
  `EmptyState`, `Spinner`.
- `Alert` dùng class `alert-tone-*` — **đừng** đổi về `alert-*`: `App.css` đã có `.alert-error`
  riêng cho thông báo ở trang đăng nhập.
- **Đã có test tự động cho UI** (`client: npm test`, vitest + Testing Library) — xem
  [testing.md](testing.md) mục 1c. Trước khi có vitest, component được kiểm tra bằng các script
  chạy một lần (không giữ lại trong repo):
  - render `react-dom/server` qua Vite SSR: 32 kiểm tra cho `components/ui`, 25 cho
    `components/form` (HTML sinh ra, thuộc tính a11y, chọn đúng control theo type);
  - `validateForm` chạy với **schema thật** trong `shared/validators`: 27 kiểm tra (bắt buộc,
    sai định dạng, trường ẩn bị loại, mật khẩu trống không gửi, refine → lỗi chung, file).
  Đợt tách Permissions / ModuleActions có thêm 38 kiểm tra (logic cây quyền, bộ lọc cây module,
  render bảng cây / cây chọn quyền / form có `render` + `normalize` / `FormModal` / `Tabs`) và
  một lần so endpoint: 33/33 lời gọi API khớp với code trước khi tách.
- **Chưa bấm thử trên trình duyệt thật.** Test chạy trong jsdom: kiểm tra được hành vi và dữ
  liệu gửi đi, **không** kiểm tra được bố cục/CSS (vd select co giãn, tab ẩn hiện đúng bằng CSS).
