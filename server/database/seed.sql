-- Seed dữ liệu khởi tạo hệ thống RBAC
-- Mật khẩu mặc định của superadmin: Admin@123 (đã hash bằng bcrypt, salt rounds = 12)

-- 1. Super Admin
INSERT INTO users (username, email, password, full_name, status)
VALUES ('superadmin', 'superadmin@example.com', '$2b$12$cDkeSAYosa1UYSSbp682au4HjAHHo11zxHk2h6J7dOtjPwQIWnSqG', 'Super Administrator', 1);

-- 2. Module catalog (module_type: 1 = Menu — hiện trên Sidebar, 2 = Screen/Function — chỉ
-- dùng làm phạm vi quyền cho tính năng/nút bên trong trang khác, không hiện trên Sidebar)
INSERT INTO modules (module_code, module_name, module_href, module_element_id, module_parent_id, module_type, module_index, description) VALUES
('MOD_DASHBOARD', 'Dashboard', '/dashboard', 'dashboard', NULL, 1, 1, 'Trang tổng quan hệ thống'),
('MOD_USER', 'User Management', '/users', 'user', NULL, 1, 2, 'Quản lý người dùng hệ thống'),
('MOD_PERMISSION', 'Role & Permission', '/permissions', 'permission', NULL, 1, 3, 'Quản lý vai trò và phân quyền'),
('MOD_AUDIT', 'Audit Log', '/audit-logs', 'audit_log', NULL, 1, 4, 'Nhật ký hoạt động hệ thống'),
('MOD_MODULE_ACTION', 'Module & Action', '/module-actions', 'module_action', NULL, 1, 5, 'Quản lý cấu trúc module và action trong hệ thống');

-- 3. Action catalog — mỗi action thuộc về đúng 1 module
INSERT INTO actions (module_id, action_code, action_name) VALUES
((SELECT id FROM modules WHERE module_code = 'MOD_DASHBOARD'), 'view', 'Xem'),

((SELECT id FROM modules WHERE module_code = 'MOD_USER'), 'view', 'Xem danh sách'),
((SELECT id FROM modules WHERE module_code = 'MOD_USER'), 'create', 'Thêm mới'),
((SELECT id FROM modules WHERE module_code = 'MOD_USER'), 'edit', 'Sửa'),
((SELECT id FROM modules WHERE module_code = 'MOD_USER'), 'delete', 'Khoá/Mở khoá'),
((SELECT id FROM modules WHERE module_code = 'MOD_USER'), 'export_excel', 'Xuất Excel'),

((SELECT id FROM modules WHERE module_code = 'MOD_PERMISSION'), 'view', 'Xem danh sách'),
((SELECT id FROM modules WHERE module_code = 'MOD_PERMISSION'), 'create', 'Thêm mới'),
((SELECT id FROM modules WHERE module_code = 'MOD_PERMISSION'), 'edit', 'Sửa'),
((SELECT id FROM modules WHERE module_code = 'MOD_PERMISSION'), 'delete', 'Xoá'),

((SELECT id FROM modules WHERE module_code = 'MOD_AUDIT'), 'view', 'Xem'),

((SELECT id FROM modules WHERE module_code = 'MOD_MODULE_ACTION'), 'view', 'Xem danh sách'),
((SELECT id FROM modules WHERE module_code = 'MOD_MODULE_ACTION'), 'create', 'Thêm mới'),
((SELECT id FROM modules WHERE module_code = 'MOD_MODULE_ACTION'), 'edit', 'Sửa'),
((SELECT id FROM modules WHERE module_code = 'MOD_MODULE_ACTION'), 'delete', 'Xoá');

-- 4. Role: Administrator - full quyền trên mọi module/action
INSERT INTO permissions (permission_code, permission_name) VALUES
('ROLE_ADMIN', 'Administrator');

INSERT INTO permission_details (permission_id, module_id, action_id)
SELECT p.id, a.module_id, a.id
FROM permissions p
CROSS JOIN actions a
WHERE p.permission_code = 'ROLE_ADMIN';

-- 5. Gán role Administrator cho superadmin
INSERT INTO user_permissions (user_id, permission_id)
SELECT u.id, p.id
FROM users u, permissions p
WHERE u.username = 'superadmin' AND p.permission_code = 'ROLE_ADMIN';
