import axiosClient from '@/core/api/axiosClient';

// Số liệu cho các thẻ thống kê ở Dashboard. Mỗi hàm trả về một con số; dùng lại các endpoint
// danh sách sẵn có (chưa có endpoint thống kê riêng) — limit: 1 để chỉ lấy pagination.total.

export const countUsers = () => axiosClient.get('/users', { params: { page: 1, limit: 1 } }).then((res) => res.data.pagination.total);

export const countRoles = () => axiosClient.get('/permissions').then((res) => res.data.data.length);

export const countModules = () => axiosClient.get('/modules').then((res) => res.data.data.length);
