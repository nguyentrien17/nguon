-- ĐÃ VIẾT NHƯNG CHƯA ĐƯỢC ÁP DỤNG. Đọc docs/database-conventions.md mục 7 trước khi chạy.
--
-- Migration này XOÁ DỮ LIỆU (dọn dòng trùng để thêm được UNIQUE). Sao lưu trước:
--   mysqldump -u root -p rbac_portal > backup_truoc_011.sql
--
-- Xử lý hai vấn đề:
--   6.1 permission_details thiếu UNIQUE -> DB thật đang có 15 tổ hợp bị lặp 2 lần
--   6.3 users có index trùng (UNIQUE đã tự sinh index, idx_username/idx_email là thừa)

-- 1. Dọn dòng permission_details trùng lặp, giữ lại dòng có id nhỏ nhất mỗi tổ hợp.
--    Quyền thực tế của user KHÔNG đổi: getUserAccess chỉ cần biết có/không có quyền.
DELETE pd FROM permission_details pd
JOIN (
    SELECT MIN(id) AS keep_id, permission_id, module_id, action_id
    FROM permission_details
    GROUP BY permission_id, module_id, action_id
    HAVING COUNT(*) > 1
) dup
  ON  pd.permission_id = dup.permission_id
  AND pd.module_id     = dup.module_id
  AND pd.action_id     = dup.action_id
  AND pd.id           <> dup.keep_id;

-- 2. Chặn trùng ở tầng DB từ nay. idx_perm_module_action (non-unique) trở thành thừa vì
--    unique key mới phủ đúng cùng bộ cột theo cùng thứ tự.
ALTER TABLE permission_details
    ADD UNIQUE KEY uk_permission_detail (permission_id, module_id, action_id);

ALTER TABLE permission_details
    DROP INDEX idx_perm_module_action;

-- 3. Bỏ index trùng trên users. Index UNIQUE trên cùng cột (tên `username`/`email`) vẫn còn,
--    nên mọi truy vấn lookup theo username/email không bị ảnh hưởng.
ALTER TABLE users
    DROP INDEX idx_username,
    DROP INDEX idx_email;
