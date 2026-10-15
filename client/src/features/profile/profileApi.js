import axiosClient from '@/core/api/axiosClient';

// Lời gọi API của trang Hồ sơ cá nhân. Đọc hồ sơ (/auth/me) nằm ở core/auth/AuthContext
// (refreshProfile) vì thông tin user dùng chung toàn ứng dụng.

/** payload: { email, full_name } */
export const updateMyProfile = (payload) => axiosClient.put('/auth/me', payload).then((res) => res.data);

/**
 * Tải ảnh đại diện (png / jpeg / webp, tối đa 2 MB — server kiểm tra lại theo nội dung file).
 * Gửi FormData: axiosClient tự ký request theo chuỗi chuẩn hoá có SHA-256 của file.
 * Trả { data: hồ sơ mới (có avatar) }.
 */
export const uploadMyAvatar = (file) => {
    const form = new FormData();
    form.append('avatar', file);
    return axiosClient.post('/auth/me/avatar', form).then((res) => res.data);
};

export const removeMyAvatar = () => axiosClient.delete('/auth/me/avatar').then((res) => res.data);

/** Server thu hồi mọi phiên KHÁC của user, giữ phiên hiện tại. */
export const changeMyPassword = (currentPassword, newPassword) =>
    axiosClient.put('/auth/password', { currentPassword, newPassword }).then((res) => res.data);
