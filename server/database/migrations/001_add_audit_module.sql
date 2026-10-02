-- Thêm module Audit Log cho các DB đã seed từ trước ngày thêm tính năng này
INSERT INTO modules (module_code, module_name, module_href, module_parent_id, module_type, module_index)
SELECT 'MOD_AUDIT', 'Audit Log', '/audit-logs', NULL, 2, 4
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE module_code = 'MOD_AUDIT');

INSERT INTO permission_details (permission_id, module_id, action_id)
SELECT p.id, m.id, a.id
FROM permissions p
CROSS JOIN modules m
CROSS JOIN actions a
WHERE p.permission_code = 'ROLE_ADMIN'
  AND m.module_code = 'MOD_AUDIT'
  AND NOT EXISTS (
    SELECT 1 FROM permission_details pd
    WHERE pd.permission_id = p.id AND pd.module_id = m.id AND pd.action_id = a.id
  );
