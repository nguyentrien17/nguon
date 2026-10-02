-- Bảng lưu token đặt lại mật khẩu (quên mật khẩu) — cùng pattern hash + expiry với
-- refresh_tokens: chỉ lưu SHA-256 của token, không lưu token gốc.
CREATE TABLE password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    used TINYINT DEFAULT 0,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_token (user_id, token_hash)
);
