import axiosClient from '@/core/api/axiosClient';

// Mọi lời gọi API của màn Vai trò & Quyền hạn (xem docs/coding-conventions.md mục 4).
// Mỗi hàm trả về res.data — shape trong docs/api-conventions.md.

/** { data: Role[] } — mỗi role kèm details [{ module_id, action_id, ... }] và user_count. */
export const listRoles = () => axiosClient.get('/permissions').then((res) => res.data);

/** payload: { permission_code, permission_name, description, permission_parent_id, details } */
export const createRole = (payload) => axiosClient.post('/permissions', payload).then((res) => res.data);

/** payload: { permission_name, description, details } — details THAY THẾ toàn bộ quyền cũ. */
export const updateRole = (id, payload) => axiosClient.put(`/permissions/${id}`, payload).then((res) => res.data);

/** Xoá cả role con và gỡ role khỏi mọi user (server xử lý). */
export const deleteRole = (id) => axiosClient.delete(`/permissions/${id}`).then((res) => res.data);

// Cây module/action để chọn quyền. Endpoint thuộc backend modules/actions; khai lại ở đây thay
// vì import từ features/module-actions (không import chéo giữa các feature).
export const listModules = () => axiosClient.get('/modules').then((res) => res.data);
export const listActions = () => axiosClient.get('/actions').then((res) => res.data);
