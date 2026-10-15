import axiosClient from '@/core/api/axiosClient';

// Lời gọi API của trang Hồ sơ cá nhân. Đọc hồ sơ (/auth/me) nằm ở core/auth/AuthContext
// (refreshProfile) vì thông tin user dùng chung toàn ứng dụng.

/** payload: { email, full_name } */
export const updateMyProfile = (payload) => axiosClient.put('/auth/me', payload).then((res) => res.data);

/** Server thu hồi mọi phiên KHÁC của user, giữ phiên hiện tại. */
export const changeMyPassword = (currentPassword, newPassword) =>
    axiosClient.put('/auth/password', { currentPassword, newPassword }).then((res) => res.data);
