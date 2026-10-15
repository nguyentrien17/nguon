import axiosClient from '@/core/api/axiosClient';

// Lời gọi API của các trang chưa đăng nhập (quên / đặt lại mật khẩu).
// Đăng nhập, đăng xuất, refresh phiên, /auth/me nằm ở core/auth/AuthContext + core/api/axiosClient
// vì là hạ tầng phiên dùng chung cho cả ứng dụng, không thuộc riêng trang nào.

/** Luôn thành công kể cả khi email không tồn tại (server chống dò email). */
export const requestPasswordReset = (email) => axiosClient.post('/auth/forgot-password', { email }).then((res) => res.data);

export const resetPassword = (token, newPassword) => axiosClient.post('/auth/reset-password', { token, newPassword }).then((res) => res.data);
