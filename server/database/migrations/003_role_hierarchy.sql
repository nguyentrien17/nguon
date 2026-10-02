-- Kích hoạt phân cấp vai trò (permission_parent_id đã có sẵn trong schema nhưng chưa dùng)
-- và thêm mô tả cho vai trò.

ALTER TABLE permissions
  ADD COLUMN description VARCHAR(500) DEFAULT NULL AFTER permission_name;

ALTER TABLE permissions
  ADD CONSTRAINT fk_permission_parent FOREIGN KEY (permission_parent_id) REFERENCES permissions(id) ON DELETE CASCADE;
