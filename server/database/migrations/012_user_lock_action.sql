-- Tách quyền khoá/mở khoá tài khoản khỏi quyền "xoá".
--
-- Trước đây khoá/mở khoá user đi qua DELETE /api/users/:id và đòi MOD_USER:delete — không thể cấp
-- quyền khoá tài khoản mà không cấp luôn quyền mang tên "xoá". Nay endpoint là
-- PATCH /api/users/:id/status và đòi quyền riêng MOD_USER:lock.
--
-- Migration CHỈ THÊM, không xoá dữ liệu, chạy lại nhiều lần vẫn an toàn (NOT EXISTS).
-- Ghi chú đánh số: 011 đang nằm ở migrations/pending/ (chưa áp dụng) — runner theo dõi theo tên
-- file đã chạy, nên áp 012 trước rồi áp 011 sau vẫn đúng.

-- 1. Action mới MOD_USER:lock
INSERT INTO actions (module_id, action_code, action_name)
SELECT m.id, 'lock', 'Khoá/Mở khoá'
FROM modules m
WHERE m.module_code = 'MOD_USER'
  AND NOT EXISTS (SELECT 1 FROM actions a WHERE a.module_id = m.id AND a.action_code = 'lock');

-- 2. Giữ nguyên năng lực hiện có: role nào đang có MOD_USER:delete (= khoá/mở khoá theo nghĩa cũ)
--    thì được cấp thêm MOD_USER:lock. Không role nào mất quyền sau migration.
INSERT INTO permission_details (permission_id, module_id, action_id)
SELECT DISTINCT pd.permission_id, lk.module_id, lk.id
FROM permission_details pd
JOIN actions del ON del.id = pd.action_id AND del.action_code = 'delete'
JOIN modules m ON m.id = del.module_id AND m.module_code = 'MOD_USER'
JOIN actions lk ON lk.module_id = m.id AND lk.action_code = 'lock'
WHERE NOT EXISTS (
    SELECT 1 FROM permission_details x WHERE x.permission_id = pd.permission_id AND x.action_id = lk.id
);

-- 3. ROLE_ADMIN luôn có đủ quyền (giao diện dựa vào danh sách quyền để hiện nút).
INSERT INTO permission_details (permission_id, module_id, action_id)
SELECT p.id, lk.module_id, lk.id
FROM permissions p
JOIN modules m ON m.module_code = 'MOD_USER'
JOIN actions lk ON lk.module_id = m.id AND lk.action_code = 'lock'
WHERE p.permission_code = 'ROLE_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM permission_details x WHERE x.permission_id = p.id AND x.action_id = lk.id
  );

-- 4. MOD_USER:delete không còn endpoint nào dùng — đổi tên cho khỏi hiểu nhầm là khoá. Giữ lại
--    (không xoá) vì xoá action sẽ cascade xoá permission_details đang tham chiếu.
UPDATE actions a
JOIN modules m ON m.id = a.module_id AND m.module_code = 'MOD_USER'
SET a.action_name = 'Xoá (chưa dùng)'
WHERE a.action_code = 'delete' AND a.action_name = 'Khoá/Mở khoá';
