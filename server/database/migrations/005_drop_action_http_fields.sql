-- http_method và endpoint chỉ là siêu dữ liệu tham khảo, không phục vụ logic phân quyền
-- (authorization chỉ dựa trên module_code + action_code) nên bỏ hẳn khỏi bảng actions.
ALTER TABLE actions
    DROP COLUMN http_method,
    DROP COLUMN endpoint;
