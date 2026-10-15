// Chuỗi chuẩn hoá để KÝ một request multipart/form-data (upload file) — dùng chung cho client
// (core/api/requestSigning.js) và server (core/security/verifySignature.js).
//
// Vì sao không ký trên byte thô như JSON: với JSON, server giữ nguyên byte body (req.rawBody) để
// tính lại chữ ký. Với multipart, body được multer đọc dạng stream và boundary do trình duyệt tự
// sinh — client không biết trước byte chính xác sẽ gửi đi. Nên cả hai bên cùng dựng một chuỗi
// mô tả NỘI DUNG: từng trường text (tên + giá trị) và từng file (tên trường + SHA-256 + kích thước).
// Sửa bất kỳ trường hay byte nào của file trên đường truyền -> chuỗi khác -> chữ ký sai.
//
// entries: [{ name, value }] với value là chuỗi (trường text) hoặc { sha256, size } (file).
// Sắp xếp để thứ tự trường trong form không ảnh hưởng kết quả.
export function canonicalMultipart(entries) {
    const items = entries.map(({ name, value }) =>
        typeof value === 'string' ? [String(name), 't', value] : [String(name), 'f', `${value.sha256}:${value.size}`]
    );
    items.sort((a, b) => (a[0] === b[0] ? (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
    return `multipart:${JSON.stringify(items)}`;
}
