import axiosClient from '@/core/api/axiosClient';

// Lời gọi API của màn Nhật ký hệ thống (xem docs/coding-conventions.md mục 4).

/** { data: AuditLog[], pagination } — params: { page, limit, action?, status? } */
export const listAuditLogs = (params) => axiosClient.get('/audit-logs', { params }).then((res) => res.data);

/** Danh sách mã hành động đã từng được ghi, cho bộ lọc. { data: string[] } */
export const listAuditActions = () => axiosClient.get('/audit-logs/actions').then((res) => res.data);
