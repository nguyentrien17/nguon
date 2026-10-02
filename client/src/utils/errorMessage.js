// Ưu tiên message backend trả về (giờ đã đúng ngôn ngữ nhờ header X-Locale), chỉ dùng bảng
// dịch client (namespace `errors`) làm fallback khi không có response (lỗi mạng...).
export function getErrorMessage(err, t) {
    const data = err.response?.data;
    return data?.message || t(`errors.${data?.errorCode || 'ERR_UNKNOWN'}`);
}
