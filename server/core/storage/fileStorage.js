const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

// File người dùng tải lên: lưu dưới env.UPLOAD_DIR, phục vụ tĩnh ở UPLOAD_PUBLIC_PREFIX
// (server.js). Thay bằng S3 / object storage sau này: chỉ cần đổi thân hai hàm dưới, giữ nguyên
// chữ ký (nhận buffer -> trả đường dẫn công khai; nhận đường dẫn công khai -> xoá).
const UPLOAD_PUBLIC_PREFIX = '/uploads';

const uploadRoot = () => path.resolve(env.UPLOAD_DIR);

/**
 * Lưu buffer thành file mới, tên ngẫu nhiên (không dùng tên file client gửi — tránh trùng, tránh
 * ký tự lạ, tránh đoán được). `folder` là hằng trong code (vd 'avatars'), không lấy từ request.
 * @returns đường dẫn công khai, vd '/uploads/avatars/3f2c...png'
 */
async function saveUpload(buffer, { folder, ext }) {
    if (!/^[a-z0-9-]+$/.test(folder) || !/^[a-z0-9]+$/.test(ext)) throw new Error(`invalid upload folder/ext: ${folder}/${ext}`);
    const dir = path.join(uploadRoot(), folder);
    await fs.mkdir(dir, { recursive: true });
    const name = `${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(path.join(dir, name), buffer, { flag: 'wx' });
    return `${UPLOAD_PUBLIC_PREFIX}/${folder}/${name}`;
}

/**
 * Xoá file đã lưu theo đường dẫn công khai. Bỏ qua (không lỗi) nếu đường dẫn không phải file do
 * server lưu (vd URL ngoài, null) hoặc file không còn. Chặn path traversal ('/uploads/../.env').
 */
async function removeUpload(publicPath) {
    if (typeof publicPath !== 'string' || !publicPath.startsWith(`${UPLOAD_PUBLIC_PREFIX}/`)) return;
    const root = uploadRoot();
    const absolute = path.resolve(root, `.${publicPath.slice(UPLOAD_PUBLIC_PREFIX.length)}`);
    if (!absolute.startsWith(root + path.sep)) return;
    await fs.rm(absolute, { force: true });
}

module.exports = { saveUpload, removeUpload, UPLOAD_PUBLIC_PREFIX };
