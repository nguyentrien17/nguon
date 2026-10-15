import catalog from '@shared/errorMessages.json';
import i18n from '@/i18n';

// Bảng dịch mã lỗi DÙNG CHUNG với server (shared/errorMessages.json) — trước đây client giữ một
// bản sao riêng trong translation.json, thiếu nhiều mã (ERR_SELF_LOCK, ERR_INVALID_SIGNATURE...).
const DEFAULT_LANG = 'en';

/** Dịch một mã lỗi (vd 'ERR_ACCOUNT_LOCKED') theo ngôn ngữ đang chọn; không có thì ERR_UNKNOWN. */
export function translateErrorCode(code, lang = i18n.resolvedLanguage || i18n.language) {
    const table = catalog[lang] || catalog[DEFAULT_LANG];
    return table[code] || catalog[DEFAULT_LANG][code] || table.ERR_UNKNOWN;
}

// Ưu tiên message backend trả về (đã đúng ngôn ngữ nhờ header X-Locale), chỉ dùng bảng dịch
// theo mã lỗi khi không có response (lỗi mạng, server không phản hồi...).
// Tham số `t` giữ để không đổi chữ ký hàm ở các nơi đang gọi.
// eslint-disable-next-line no-unused-vars
export function getErrorMessage(err, t) {
    const data = err.response?.data;
    return data?.message || translateErrorCode(data?.errorCode || 'ERR_UNKNOWN');
}
