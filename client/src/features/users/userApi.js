import axiosClient from '@/core/api/axiosClient';

// Mọi lời gọi API của feature users. Component không gọi axiosClient trực tiếp — đổi endpoint
// hay shape request chỉ phải sửa ở đây (kế hoạch refactor mục 11: tách API riêng của feature
// khỏi hạ tầng request trong core/api).
//
// Mỗi hàm trả về `data` của response (đã bỏ lớp axios), đúng shape trong docs/api-conventions.md.
// Lỗi được ném nguyên vẹn để caller hiển thị qua getErrorMessage(err, t).

/** { data: User[], pagination } — params: { page, limit, search? } */
export const listUsers = (params) => axiosClient.get('/users', { params }).then((res) => res.data);

/** payload: { username, email, full_name, password, role_ids } */
export const createUser = (payload) => axiosClient.post('/users', payload).then((res) => res.data);

/** payload: { email?, full_name?, avatar?, password? } — password undefined = giữ nguyên */
export const updateUser = (id, payload) => axiosClient.put(`/users/${id}`, payload).then((res) => res.data);

/** Đặt trạng thái: status = USER_STATUS.LOCKED (0) | ACTIVE (1). Trả { data: { id, status } }. Cần MOD_USER:lock. */
export const setUserStatus = (id, status) => axiosClient.patch(`/users/${id}/status`, { status }).then((res) => res.data);

/** File .xlsx dạng Blob, theo cùng bộ lọc với danh sách. */
export const exportUsers = (params) => axiosClient.get('/users/export', { params, responseType: 'blob' }).then((res) => res.data);

// --- Role của user ---
// Các endpoint dưới đây thuộc backend feature permissions, nhưng chỉ feature users gọi từ phía
// client nên đặt ở đây — tránh để features/users import vào features/permissions.

/** Tất cả role, để chọn khi tạo user / gán role. { data: Role[] } */
export const listRoles = () => axiosClient.get('/permissions').then((res) => res.data);

/** Role đang gán cho một user. { data: [{ id, permission_code, permission_name }] } */
export const listUserRoles = (userId) => axiosClient.get(`/users/${userId}/roles`).then((res) => res.data);

export const assignRole = (roleId, userId) => axiosClient.post(`/permissions/${roleId}/assign`, { user_id: userId }).then((res) => res.data);

export const unassignRole = (roleId, userId) =>
    axiosClient.delete(`/permissions/${roleId}/assign`, { data: { user_id: userId } }).then((res) => res.data);
