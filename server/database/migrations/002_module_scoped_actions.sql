-- Chuyển actions từ danh sách dùng chung toàn cục sang thuộc về từng module cụ thể.
-- Thêm module quản trị mới "Module & Action" (MOD_MODULE_ACTION).
-- Chạy tuần tự toàn bộ file này bằng mysql CLI trên DB đã seed từ trước.

-- 1. Thêm cột mới cho modules + FK tự tham chiếu để xoá module cha cascade xoá module con
ALTER TABLE modules
  ADD COLUMN module_element_id VARCHAR(100) DEFAULT NULL AFTER module_href,
  ADD COLUMN status TINYINT NOT NULL DEFAULT 1 COMMENT '1: Hoạt động, 0: Ngưng hoạt động' AFTER module_index,
  ADD COLUMN description VARCHAR(500) DEFAULT NULL AFTER status,
  ADD CONSTRAINT fk_module_parent FOREIGN KEY (module_parent_id) REFERENCES modules(id) ON DELETE CASCADE;

-- 2. Thêm cột mới cho actions (module_id tạm thời nullable để migrate dữ liệu cũ)
ALTER TABLE actions
  ADD COLUMN module_id INT NULL AFTER id,
  ADD COLUMN http_method VARCHAR(10) DEFAULT NULL AFTER action_name,
  ADD COLUMN endpoint VARCHAR(255) DEFAULT NULL AFTER http_method,
  ADD COLUMN status TINYINT NOT NULL DEFAULT 1 COMMENT '1: Hoạt động, 0: Ngưng hoạt động' AFTER endpoint,
  ADD COLUMN description VARCHAR(500) DEFAULT NULL AFTER status;

-- 3. Module quản trị mới cho trang Module & Action
INSERT INTO modules (module_code, module_name, module_href, module_parent_id, module_type, module_index)
SELECT 'MOD_MODULE_ACTION', 'Module & Action', '/module-actions', NULL, 2, 5
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE module_code = 'MOD_MODULE_ACTION');

-- 3b. Bỏ unique constraint toàn cục trên action_code TRƯỚC khi fan-out (nếu không sẽ đụng
-- duplicate key vì bước 4 chèn nhiều dòng cùng action_code cho các module khác nhau)
ALTER TABLE actions DROP INDEX action_code;

-- 4. Fan-out: tạo action riêng cho từng module thực sự dùng nó (dựa trên các route hiện có)
INSERT INTO actions (module_id, action_code, action_name)
SELECT m.id, a.action_code, a.action_name
FROM modules m
CROSS JOIN actions a
WHERE a.module_id IS NULL
  AND (
    (m.module_code = 'MOD_DASHBOARD' AND a.action_code IN ('view'))
    OR (m.module_code = 'MOD_USER' AND a.action_code IN ('view', 'create', 'edit', 'delete', 'export_excel'))
    OR (m.module_code = 'MOD_PERMISSION' AND a.action_code IN ('view', 'create', 'edit', 'delete'))
    OR (m.module_code = 'MOD_AUDIT' AND a.action_code IN ('view'))
    OR (m.module_code = 'MOD_MODULE_ACTION' AND a.action_code IN ('view', 'create', 'edit', 'delete'))
  )
  AND NOT EXISTS (
    SELECT 1 FROM actions na WHERE na.module_id = m.id AND na.action_code = a.action_code
  );

-- 5. Remap permission_details sang action mới theo đúng module của từng dòng cũ
UPDATE permission_details pd
JOIN actions old_a ON old_a.id = pd.action_id AND old_a.module_id IS NULL
JOIN actions new_a ON new_a.module_id = pd.module_id AND new_a.action_code = old_a.action_code
SET pd.action_id = new_a.id;

-- 6. Xoá các action toàn cục cũ còn sót (không còn được permission_details tham chiếu)
DELETE FROM actions WHERE module_id IS NULL;

-- 7. Ràng buộc lại: module_id bắt buộc, unique theo (module_id, action_code) thay vì action_code toàn cục
ALTER TABLE actions
  MODIFY COLUMN module_id INT NOT NULL,
  ADD CONSTRAINT fk_action_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  ADD UNIQUE KEY uk_module_action (module_id, action_code);

-- 8. Gán full quyền module mới cho ROLE_ADMIN
INSERT INTO permission_details (permission_id, module_id, action_id)
SELECT p.id, a.module_id, a.id
FROM permissions p
CROSS JOIN actions a
JOIN modules m ON m.id = a.module_id
WHERE p.permission_code = 'ROLE_ADMIN'
  AND m.module_code = 'MOD_MODULE_ACTION'
  AND NOT EXISTS (
    SELECT 1 FROM permission_details pd
    WHERE pd.permission_id = p.id AND pd.module_id = a.module_id AND pd.action_id = a.id
  );
