# Refactor Source thành Application Starter

## 1. Bối cảnh

Repository hiện tại là ứng dụng RBAC Portal, sử dụng:

-   Frontend: React + Vite
-   Backend: Node.js + Express
-   Database: MySQL
-   Validation/shared contracts: Zod
-   Kiến trúc backend theo feature, gồm controller, service, model và
    routes

Mục tiêu là phát triển repository này thành **source nền tảng có thể tái
sử dụng cho nhiều dự án khác nhau**, từ dự án nhỏ đến dự án lớn. RBAC
Portal hiện tại nên được xem là một ứng dụng mẫu/module tham khảo, không
phải toàn bộ kiến trúc nền tảng.

## 2. Mục tiêu refactor

1.  Phân tách rõ **Core**, **Features**, **Shared** và phần khởi tạo ứng
    dụng.
2.  Giữ lại các chức năng hiện có; không viết lại toàn bộ ứng dụng nếu
    không cần thiết.
3.  Tạo quy tắc phụ thuộc giữa các lớp để hạn chế việc các module phụ
    thuộc chéo tùy tiện.
4.  Chuẩn hóa cấu hình môi trường, xử lý lỗi, phản hồi API, logging,
    database/migrations và validation.
5.  Chuẩn bị nền tảng cho testing, CI và Docker ở các giai đoạn tiếp
    theo.
6.  Đảm bảo ứng dụng vẫn chạy được sau mỗi giai đoạn refactor.

## 3. Nguyên tắc bắt buộc

-   **Không rewrite toàn bộ source chỉ để đổi cấu trúc thư mục.**
-   Không xóa chức năng hiện có nếu chưa xác định được nơi thay thế và
    kiểm thử tương ứng.
-   Không tự ý thêm nghiệp vụ mới.
-   Không thay đổi API contract, tên endpoint, cấu trúc database hoặc
    luồng đăng nhập một cách âm thầm.
-   Không thay đổi các thông tin xác thực, secrets, dữ liệu seed hoặc
    thông tin môi trường đang dùng nếu không có yêu cầu.
-   Không đưa secrets vào Git.
-   Ưu tiên các thay đổi nhỏ, có thể kiểm tra và rollback.
-   Trước khi di chuyển file, phải kiểm tra import, alias, script chạy,
    migration và các tham chiếu liên quan.
-   Nếu một thay đổi có nguy cơ phá vỡ tương thích, hãy ghi rõ tác động
    và đề xuất phương án; không tự ý thực hiện thay đổi lớn.
-   Không chuyển JavaScript sang TypeScript trong đợt refactor đầu tiên.
-   Không thêm thư viện mới nếu chức năng tương đương đã có hoặc chưa
    chứng minh được nhu cầu.
-   Không coi việc tạo thư mục mới là hoàn thành refactor; phải có ranh
    giới trách nhiệm rõ ràng.

## 4. Phân biệt Core, Features và Shared

### 4.1. Core

Core chứa hạ tầng kỹ thuật có thể dùng lại trong nhiều dự án và không
phụ thuộc vào nghiệp vụ cụ thể.

Ví dụ:

-   Đọc và kiểm tra biến môi trường
-   Khởi tạo kết nối và connection pool database
-   Logger
-   Lớp lỗi ứng dụng và xử lý lỗi tập trung
-   Middleware HTTP dùng chung
-   Validation infrastructure
-   Tiện ích phân trang
-   Transaction helpers
-   Security utilities
-   Cấu hình CORS, Helmet, rate limiting
-   Quy ước phản hồi API
-   Tiện ích dùng chung không gắn với một domain cụ thể

Không đưa logic nghiệp vụ như quản lý nông hộ, sản phẩm, đơn hàng, hóa
đơn hoặc quy tắc phân quyền cụ thể vào Core.

### 4.2. Features

Features chứa các nghiệp vụ hoặc module có thể bật, tắt, thay thế hoặc
phát triển độc lập tương đối.

Các module hiện có cần được giữ lại và tổ chức hợp lý, ví dụ:

-   Auth: đăng nhập, đăng xuất, refresh token, quên/đặt lại mật khẩu
-   Users: quản lý người dùng
-   RBAC: roles, permissions, modules, actions
-   Audit logs: truy vấn và hiển thị lịch sử hoạt động
-   Insights/dashboard: số liệu tổng quan

Lưu ý: hạ tầng kỹ thuật như JWT helper, password hashing hoặc
session/token primitives có thể thuộc Core; các use case đăng nhập và
luồng nghiệp vụ xác thực vẫn có thể nằm trong feature Auth. Không chuyển
toàn bộ Auth vào Core một cách máy móc.

### 4.3. Shared

Shared chỉ chứa các thành phần thực sự được dùng chung giữa client và
server, chẳng hạn:

-   Constants dùng chung
-   Schema/validator dùng chung bằng Zod
-   Error codes hoặc contract dùng chung
-   Kiểu dữ liệu/DTO hoặc API contract trung lập với môi trường chạy

Shared không được import trực tiếp code riêng của client hoặc server.
Không đưa logic truy cập database, React component, Express middleware
hay secrets vào Shared.

## 5. Cấu trúc thư mục định hướng

Đây là cấu trúc mục tiêu để tham khảo, không phải yêu cầu phải di chuyển
tất cả file trong một lần. Hãy điều chỉnh dựa trên cấu trúc thực tế và
bảo đảm tương thích.

### Backend

``` text
server/
├── app.js hoặc server.js
├── core/
│   ├── config/
│   ├── database/
│   ├── errors/
│   ├── logger/
│   ├── middleware/
│   ├── security/
│   ├── http/
│   └── utils/
├── features/
│   ├── auth/
│   ├── users/
│   ├── rbac/
│   │   ├── permissions/
│   │   ├── modules/
│   │   └── actions/
│   ├── audit-logs/
│   └── insights/
├── routes/
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   └── migrations/
└── tests/
```

Có thể giữ cấu trúc feature hiện tại nếu đã rõ ràng. Không bắt buộc gộp
`permissions`, `modules` và `actions` vào `rbac` ngay trong đợt đầu nếu
việc đó làm tăng rủi ro. Quan trọng nhất là xác định được ranh giới
Core/Feature và quy tắc phụ thuộc.

### Frontend

``` text
client/src/
├── app/
│   ├── router/
│   ├── providers/
│   └── config/
├── core/
│   ├── api/
│   ├── auth/
│   ├── permissions/
│   ├── errors/
│   └── storage/
├── components/
│   └── ui/
├── features/
│   ├── auth/
│   ├── users/
│   ├── rbac/
│   ├── audit-logs/
│   └── dashboard/
├── hooks/
├── lib/
├── shared/
└── i18n/
```

Không cần chuyển toàn bộ frontend trong một lần. Có thể bắt đầu bằng
việc xác định `app`, `core`, `features` và di chuyển từng module sau khi
kiểm tra import.

### Tài liệu

``` text
docs/
├── architecture.md
├── folder-structure.md
├── coding-conventions.md
├── dependency-rules.md
├── api-conventions.md
├── database-conventions.md
├── security.md
├── testing.md
└── development-guide.md
```

Nếu repository đang sử dụng thư mục `tailieu/`, hãy xem xét giữ lại hoặc
chuẩn hóa thành `docs/`. Không xóa tài liệu cũ nếu chưa kiểm tra nội
dung và liên kết.

## 6. Quy tắc phụ thuộc kiến trúc

Áp dụng các quy tắc sau và ghi rõ trong `docs/dependency-rules.md`:

1.  Core không được import trực tiếp từ Features.
2.  Shared không được phụ thuộc vào Core, Features, React hoặc Express.
3.  Feature có thể dùng Core và Shared.
4.  Hạn chế feature import trực tiếp model nội bộ của feature khác.
5.  Khi cần trao đổi giữa các feature, ưu tiên gọi service/use case qua
    giao diện rõ ràng hoặc tách logic thực sự dùng chung thành module
    phù hợp.
6.  Không tạo vòng phụ thuộc.
7.  Controller xử lý HTTP request/response và gọi service; không chứa
    truy vấn SQL hoặc nghiệp vụ phức tạp.
8.  Service xử lý use case/nghiệp vụ; không phụ thuộc trực tiếp vào đối
    tượng HTTP response.
9.  Model/repository chịu trách nhiệm truy cập dữ liệu.
10. Validator kiểm tra dữ liệu đầu vào; không thay thế kiểm tra quyền
    truy cập hoặc quy tắc nghiệp vụ.

Không refactor quá mức. Chỉ tách lớp khi việc tách làm rõ trách nhiệm
hoặc giảm phụ thuộc thực sự.

## 7. Chuẩn hóa cấu hình môi trường

Kiểm tra và chuẩn hóa cách quản lý cấu hình:

-   Tách cấu hình theo môi trường, ví dụ development, test và
    production.
-   Có một điểm đọc/kiểm tra biến môi trường rõ ràng.
-   Ứng dụng phải báo lỗi dễ hiểu khi thiếu biến môi trường bắt buộc.
-   Không để secrets có giá trị mặc định không an toàn trong production.
-   Cung cấp `.env.example` với tên biến và giá trị minh họa không nhạy
    cảm.
-   Đảm bảo `.env`, credentials, private keys và dữ liệu nhạy cảm được
    loại khỏi Git.
-   Tránh đọc `process.env` tùy tiện ở nhiều module; ưu tiên truy cập
    qua module config sau khi khởi tạo.

Không đổi tên các biến môi trường hiện tại nếu chưa cập nhật đồng bộ tất
cả nơi sử dụng và tài liệu.

## 8. Database và migration

-   Giữ database schema hiện tại hoạt động.
-   Duy trì migration tracking hiện có.
-   Migration phải có tên rõ ràng, có thứ tự và có thể kiểm tra trạng
    thái.
-   Không chỉnh sửa migration đã được triển khai ở môi trường dùng chung
    nếu quy trình dự án yêu cầu migration mới.
-   Kiểm tra khóa ngoại, unique constraints, index và tính nhất quán dữ
    liệu.
-   Rà soát các quan hệ RBAC, đặc biệt tính duy nhất của tổ hợp
    permission/module/action và tính hợp lệ giữa action với module.
-   Không tự ý chạy migration phá hủy dữ liệu trên database thật.
-   Đề xuất thay đổi schema riêng, giải thích tác động và tạo migration
    mới khi cần.

## 9. Chuẩn hóa API và xử lý lỗi

Trước tiên, hãy khảo sát response format hiện tại. Nếu cần chuẩn hóa, đề
xuất và áp dụng nhất quán, nhưng không âm thầm phá vỡ client hiện tại.

Ví dụ response thành công:

``` json
{
  "success": true,
  "data": {}
}
```

Ví dụ response danh sách:

``` json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Ví dụ response lỗi:

``` json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  }
}
```

Yêu cầu:

-   Lỗi ứng dụng có mã lỗi, HTTP status và thông báo rõ ràng.
-   Có error-handling middleware tập trung.
-   Không trả stack trace hoặc chi tiết nội bộ cho client trong
    production.
-   Log lỗi ở server với đủ ngữ cảnh nhưng không ghi password, token,
    secrets hoặc dữ liệu nhạy cảm.
-   Giữ tương thích với client hiện tại hoặc tạo kế hoạch chuyển đổi có
    kiểm thử.

## 10. Authentication, Authorization và RBAC

-   Phân biệt authentication (xác minh danh tính) với authorization
    (kiểm tra quyền).
-   Giữ nguyên luồng access token/refresh token hiện có nếu chưa có lý
    do và kế hoạch thay đổi rõ ràng.
-   Rà soát refresh token rotation/revocation, cookie flags, password
    reset, login throttling/lockout và CORS.
-   Quyền phải được kiểm tra ở backend; không chỉ ẩn nút hoặc trang ở
    frontend.
-   Không xem việc ẩn giao diện là biện pháp bảo mật.
-   Hạn chế đưa toàn bộ quyền có thể thay đổi vào token dài hạn nếu điều
    đó khiến quyền cũ vẫn còn hiệu lực.
-   Kiểm tra các middleware ký request và rate limiting để tránh gây
    phức tạp không cần thiết hoặc lỗi tương thích.
-   Không loại bỏ cơ chế bảo vệ hiện có chỉ vì muốn đơn giản hóa code.

RBAC nên được giữ như một module/feature mẫu có thể tái sử dụng hoặc
thay thế tùy dự án. Không để Core phụ thuộc vào tên bảng, tên module
hoặc nghiệp vụ RBAC cụ thể.

## 11. Frontend

-   Tách phần khởi tạo ứng dụng, routing, providers và cấu hình khỏi các
    feature.
-   Tách API client/hạ tầng request khỏi API riêng của từng feature.
-   Giữ các component UI dùng chung ở vị trí riêng.
-   Tránh để AuthContext hoặc một context duy nhất gánh quá nhiều trách
    nhiệm.
-   Kiểm tra luồng refresh token, xử lý 401, retry request và đăng xuất
    để tránh vòng lặp hoặc request trùng.
-   Tránh import trực tiếp logic nội bộ giữa các feature.
-   Giữ nguyên hành vi giao diện hiện tại trong đợt refactor cấu trúc.
-   Chưa cần đổi thư viện state management, UI library hoặc chuyển sang
    TypeScript nếu chưa có yêu cầu.

## 12. Logging và audit log

Phân biệt:

-   **Application logging:** lỗi, cảnh báo, trạng thái hệ thống và thông
    tin vận hành.
-   **Audit logging:** ai thực hiện hành động gì, lên đối tượng nào, vào
    thời điểm nào và kết quả ra sao.

Audit log phục vụ nghiệp vụ/kiểm toán có thể thuộc feature riêng; logger
kỹ thuật thuộc Core.

Không ghi mật khẩu, access token, refresh token, secret hoặc thông tin
nhạy cảm vào log. Kiểm tra các nơi đang ghi log và chuẩn hóa mức độ log
phù hợp với môi trường.

## 13. Kiểm thử và chất lượng

Repository hiện chưa có bộ automated tests hoàn chỉnh theo tài liệu hiện
tại. Hãy lập kế hoạch bổ sung theo từng bước, không cần viết thật nhiều
test trước khi cấu trúc ổn định.

Ưu tiên:

1.  Smoke test cho khởi động server và client.
2.  Test cấu hình thiếu biến môi trường.
3.  Test error handler và validator dùng chung.
4.  Test đăng nhập, refresh token, logout và quyền truy cập.
5.  Test các service quan trọng.
6.  Test API cho users và RBAC.
7.  Test migration trên database thử nghiệm.
8.  Thêm lint/format và CI ở giai đoạn phù hợp.

Không tuyên bố test đã chạy thành công nếu chưa thực sự chạy. Ghi rõ các
lệnh đã chạy, kết quả và phần chưa kiểm tra.

## 14. Chuẩn hóa dependency và scripts

-   Kiểm tra dependency trùng lặp hoặc khác phiên bản giữa root, client,
    server và shared.
-   Đồng bộ phiên bản Zod dùng chung nếu tương thích.
-   Chỉ giữ dependency cần thiết.
-   Xác minh Node.js version yêu cầu và ghi rõ trong tài liệu.
-   Kiểm tra các script cài đặt, dev, build, start, migrate và audit.
-   Không tự ý nâng cấp hàng loạt package trong cùng đợt refactor cấu
    trúc.
-   Không cập nhật lockfile theo cách không kiểm soát.

## 15. Thứ tự triển khai bắt buộc

Agent cần làm theo từng giai đoạn và báo cáo sau mỗi giai đoạn.

### Giai đoạn 1 --- Khảo sát trước khi sửa

-   Kiểm tra toàn bộ cấu trúc thư mục.
-   Đọc `README.md`, `package.json` ở root/client/server, các file khởi
    tạo ứng dụng và cấu hình.
-   Lập bản đồ các module và luồng import chính.
-   Xác định alias, scripts, routes, middleware, database và migrations.
-   Ghi lại các lệnh hiện có để chạy ứng dụng.
-   Liệt kê rủi ro tương thích.
-   Chưa di chuyển hoặc xóa file ở bước này.

**Đầu ra:** báo cáo hiện trạng và kế hoạch refactor cụ thể.

### Giai đoạn 2 --- Định nghĩa kiến trúc và quy ước

-   Xác định rõ Core, Features, Shared.
-   Viết `docs/architecture.md`.
-   Viết `docs/folder-structure.md`.
-   Viết `docs/dependency-rules.md`.
-   Ghi rõ cách xử lý các trường hợp ranh giới như Auth, Users, RBAC và
    Audit Logs.

**Đầu ra:** tài liệu kiến trúc phù hợp với source thực tế.

### Giai đoạn 3 --- Refactor backend từng phần

-   Bắt đầu từ các thành phần hạ tầng ít phụ thuộc nghiệp vụ: config,
    database, errors, logger, middleware và utilities.
-   Cập nhật import/alias và scripts tương ứng.
-   Giữ nguyên endpoint và hành vi API.
-   Chạy kiểm tra sau mỗi nhóm thay đổi.
-   Không chuyển tất cả feature cùng lúc nếu có rủi ro cao.

### Giai đoạn 4 --- Refactor frontend từng phần

-   Tách app bootstrap, router, providers và API infrastructure.
-   Chuyển từng feature một cách có kiểm soát.
-   Cập nhật import và đường dẫn.
-   Giữ nguyên hành vi hiện tại.

### Giai đoạn 5 --- Chuẩn hóa shared và contracts

-   Rà soát constants, Zod schemas, error codes và API contracts.
-   Loại bỏ code trùng lặp.
-   Đảm bảo Shared không phụ thuộc vào client/server.

### Giai đoạn 6 --- Kiểm thử và tài liệu vận hành

-   Chạy các lệnh kiểm tra có sẵn.
-   Bổ sung smoke tests phù hợp.
-   Cập nhật README và hướng dẫn phát triển.
-   Ghi rõ cách cài đặt, cấu hình môi trường, tạo database, chạy
    migration và khởi động dự án.

### Giai đoạn 7 --- Đề xuất việc còn lại

Sau khi các bước trên hoàn thành, lập danh sách riêng cho:

-   Automated tests mở rộng
-   Docker/dev container
-   CI pipeline
-   TypeScript migration
-   Observability nâng cao
-   Tối ưu hiệu năng

Không triển khai toàn bộ các mục này trong đợt đầu nếu chưa được yêu
cầu.

## 16. Tiêu chí hoàn thành

Đợt refactor đầu tiên được xem là hoàn thành khi:

-   [ ] Có tài liệu kiến trúc mô tả đúng source thực tế.
-   [ ] Ranh giới Core, Features và Shared được xác định rõ.
-   [ ] Các quy tắc phụ thuộc được ghi lại.
-   [ ] Không có import vòng mới do refactor.
-   [ ] Không có chức năng hiện tại bị xóa ngoài kế hoạch được chấp
    thuận.
-   [ ] Các biến môi trường và secrets được quản lý an toàn.
-   [ ] Database schema và migration hiện tại được giữ nguyên hoặc mọi
    thay đổi đều có migration rõ ràng.
-   [ ] Client và server khởi động được theo hướng dẫn cập nhật.
-   [ ] Các lệnh build/lint/test hiện có đã được chạy nếu có; kết quả
    được báo cáo trung thực.
-   [ ] Các thay đổi API hoặc database có ảnh hưởng tương thích được ghi
    rõ.
-   [ ] README và tài liệu phát triển được cập nhật.
-   [ ] Có báo cáo cuối cùng nêu rõ file đã sửa, lý do sửa, kiểm tra đã
    chạy, kết quả và việc còn tồn đọng.

## 17. Những việc Agent không được tự ý làm

-   Không rewrite toàn bộ dự án.
-   Không đổi framework hoặc database.
-   Không chuyển sang TypeScript ngay.
-   Không thêm chức năng nghiệp vụ mới.
-   Không xóa RBAC hoặc các module đang dùng.
-   Không thay đổi API/DB một cách âm thầm.
-   Không xóa migration, seed hoặc dữ liệu.
-   Không tự ý chạy lệnh có thể phá hủy dữ liệu.
-   Không commit/push hoặc tạo pull request nếu chưa được yêu cầu rõ
    ràng.
-   Không tuyên bố đã kiểm tra một phần code nếu chưa thực sự mở và kiểm
    tra phần đó.
-   Không tạo cấu trúc thư mục chỉ để đáp ứng hình thức mà không cập
    nhật code/import liên quan.

## 18. Định dạng báo cáo của Agent

Sau mỗi giai đoạn, báo cáo theo mẫu:

``` text
Giai đoạn:
1. Đã kiểm tra:
2. Đã thay đổi:
3. Lý do:
4. File ảnh hưởng:
5. Lệnh kiểm tra đã chạy:
6. Kết quả:
7. Rủi ro hoặc vấn đề chưa xử lý:
8. Bước tiếp theo đề xuất:
```

Nếu phát hiện vấn đề lớn hoặc cần quyết định kiến trúc có ảnh hưởng
rộng, hãy dừng trước khi thực hiện và trình bày các lựa chọn cùng
ưu/nhược điểm.

## 19. Yêu cầu bắt đầu

Bắt đầu với **Giai đoạn 1 --- Khảo sát trước khi sửa**. Chỉ đọc và phân
tích source trước, sau đó báo cáo hiện trạng, các ranh giới
Core/Features/Shared đề xuất và kế hoạch thay đổi theo từng nhóm file.

Không bắt đầu bằng việc di chuyển hàng loạt file. Sau khi có báo cáo
khảo sát, mới tiến hành các thay đổi nhỏ theo thứ tự ở trên.
