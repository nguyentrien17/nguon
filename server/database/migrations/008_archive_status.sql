-- Mở rộng ngữ nghĩa cột status sẵn có (TINYINT) sang giá trị 2 = Đã lưu trữ, để module/action
-- có thể "lưu trữ" (archive) thay vì xoá cứng ngay, tránh mất dữ liệu ngoài ý muốn khi cascade.
ALTER TABLE modules
    MODIFY status TINYINT NOT NULL DEFAULT 1 COMMENT '1: Hoạt động, 0: Ngưng hoạt động, 2: Đã lưu trữ';
ALTER TABLE actions
    MODIFY status TINYINT NOT NULL DEFAULT 1 COMMENT '1: Hoạt động, 0: Ngưng hoạt động, 2: Đã lưu trữ';

-- Tăng tốc truy vấn "action chưa được role nào cấp quyền" và tra cứu ngược action -> role
-- (trước đây chỉ có index dẫn đầu bằng permission_id, không phù hợp để lọc/nhóm theo action_id).
CREATE INDEX idx_perm_action ON permission_details (action_id);
