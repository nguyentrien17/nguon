import axiosClient from '@/core/api/axiosClient';

// Mọi lời gọi API của màn Module & Action (xem docs/coding-conventions.md mục 4).
// Mỗi hàm trả về res.data — shape trong docs/api-conventions.md.

export const listModules = () => axiosClient.get('/modules').then((res) => res.data);
export const listActions = () => axiosClient.get('/actions').then((res) => res.data);

/** { data: { unusedActions, emptyModules, unusedRoles, actionRoleMap } } */
export const getInsights = () => axiosClient.get('/insights/module-actions').then((res) => res.data);

// ---------- Module ----------
export const createModule = (payload) => axiosClient.post('/modules', payload).then((res) => res.data);
export const updateModule = (id, payload) => axiosClient.put(`/modules/${id}`, payload).then((res) => res.data);
export const deleteModule = (id) => axiosClient.delete(`/modules/${id}`).then((res) => res.data);
export const archiveModule = (id) => axiosClient.post(`/modules/${id}/archive`).then((res) => res.data);
export const restoreModule = (id) => axiosClient.post(`/modules/${id}/restore`).then((res) => res.data);
/** payload: { module_code, module_name } — sao chép module kèm action của nó. */
export const cloneModule = (id, payload) => axiosClient.post(`/modules/${id}/clone`, payload).then((res) => res.data);
// PUT đòi module_name (updateModuleSchema) nên gửi kèm tên hiện tại khi chỉ đổi trạng thái.
export const setModuleStatus = (module, status) =>
    axiosClient.put(`/modules/${module.id}`, { module_name: module.module_name, status }).then((res) => res.data);

// ---------- Action ----------
export const createAction = (payload) => axiosClient.post('/actions', payload).then((res) => res.data);
export const updateAction = (id, payload) => axiosClient.put(`/actions/${id}`, payload).then((res) => res.data);
export const deleteAction = (id) => axiosClient.delete(`/actions/${id}`).then((res) => res.data);
export const archiveAction = (id) => axiosClient.post(`/actions/${id}/archive`).then((res) => res.data);
export const restoreAction = (id) => axiosClient.post(`/actions/${id}/restore`).then((res) => res.data);
export const setActionStatus = (action, status) =>
    axiosClient.put(`/actions/${action.id}`, { action_name: action.action_name, status }).then((res) => res.data);
/** Tạo bộ action chuẩn (view/create/edit/delete...) còn thiếu cho module. { data: { created: string[] } } */
export const scaffoldActions = (moduleId) => axiosClient.post(`/actions/scaffold/${moduleId}`).then((res) => res.data);
