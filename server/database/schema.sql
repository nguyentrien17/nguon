-- 1. Bảng quản lý người dùng (Tối ưu và tinh gọn)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar VARCHAR(500) DEFAULT NULL,
    status TINYINT DEFAULT 1 COMMENT '1: Hoạt động, 0: Khóa',
    failed_login_attempts INT DEFAULT 0,
    locked_until DATETIME(3) DEFAULT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX idx_username (username),
    INDEX idx_email (email)
);

-- 2. Bảng quản lý Nhóm quyền / Vai trò (Roles)
CREATE TABLE permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    permission_code VARCHAR(100) NOT NULL UNIQUE,
    permission_name VARCHAR(255) NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    permission_parent_id INT DEFAULT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    FOREIGN KEY (permission_parent_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 3. Bảng quản lý Menu và Màn hình (Modules)
CREATE TABLE modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module_code VARCHAR(100) NOT NULL UNIQUE,
    module_name VARCHAR(255) NOT NULL,
    module_href VARCHAR(255),
    module_element_id VARCHAR(100) DEFAULT NULL,
    module_parent_id INT DEFAULT NULL,
    module_type TINYINT COMMENT '1: Menu, 2: Screen',
    module_icon VARCHAR(50) DEFAULT NULL COMMENT 'Tên icon lucide-react, vd: Users, FileText',
    module_index INT DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1: Hoạt động, 0: Ngưng hoạt động, 2: Đã lưu trữ',
    description VARCHAR(500) DEFAULT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    FOREIGN KEY (module_parent_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- 4. Bảng quản lý các hành động / Thao tác (Actions) — mỗi action thuộc về đúng 1 module
CREATE TABLE actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INT NOT NULL,
    action_code VARCHAR(100) NOT NULL,
    action_name VARCHAR(255) NOT NULL,
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1: Hoạt động, 0: Ngưng hoạt động, 2: Đã lưu trữ',
    description VARCHAR(500) DEFAULT NULL,
    rate_limit_per_minute INT DEFAULT NULL COMMENT 'Giới hạn số lần gọi/phút riêng cho action này, NULL = không giới hạn ngoài rate limit chung',
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    UNIQUE KEY uk_module_action (module_id, action_code)
);

-- 5. Bảng trung gian: Gán Nhóm quyền cho Người dùng (User <-> Permission)
CREATE TABLE user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    permission_id INT NOT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_permission (user_id, permission_id)
);

-- 6. Bảng trung gian cốt lõi: Chi tiết quyền (Permission <-> Module <-> Action)
CREATE TABLE permission_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    permission_id INT NOT NULL,
    module_id INT NOT NULL,
    action_id INT NOT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE,
    INDEX idx_perm_module_action (permission_id, module_id, action_id),
    INDEX idx_perm_action (action_id)
);

-- 7. Bảng lưu Refresh Token (hỗ trợ rotation, thu hồi)
CREATE TABLE refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    revoked TINYINT DEFAULT 0,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_token (user_id, token_hash)
);

-- 7b. Bảng lưu token đặt lại mật khẩu (quên mật khẩu)
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

-- 8. Bảng Audit Log phục vụ Level-3 Security (điều tra pháp lý)
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    action VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    status VARCHAR(20) NOT NULL COMMENT 'SUCCESS | FAILURE',
    detail TEXT DEFAULT NULL,
    created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created_at (created_at)
);
