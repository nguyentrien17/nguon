-- Cho phép cấu hình giới hạn tần suất gọi riêng cho từng action nhạy cảm
-- (vd delete, export_excel), độc lập với rate limit chung (apiLimiter) áp dụng toàn API.
ALTER TABLE actions
    ADD COLUMN rate_limit_per_minute INT DEFAULT NULL COMMENT 'Giới hạn số lần gọi/phút riêng cho action này, NULL = không giới hạn ngoài rate limit chung';
