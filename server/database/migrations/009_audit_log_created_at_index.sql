-- audit_logs chỉ có index trên user_id/action, còn danh sách audit log luôn
-- ORDER BY created_at DESC + phân trang (xem auditLogModel.list) — thiếu index này
-- dẫn tới filesort + quét toàn bảng khi số bản ghi tăng lên.
CREATE INDEX idx_audit_created_at ON audit_logs (created_at);
