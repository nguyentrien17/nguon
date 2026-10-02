-- Cho phép admin tự chọn icon hiển thị cho module trên Sidebar thay vì hard-code
-- trong ICONS map của Sidebar.jsx theo module_code.
ALTER TABLE modules
    ADD COLUMN module_icon VARCHAR(50) DEFAULT NULL COMMENT 'Tên icon lucide-react, vd: Users, FileText' AFTER module_type;
