-- Cột module_type (1: Menu, 2: Screen/Function) đã có sẵn trong schema nhưng trước đây bị
-- hard-code = 2 cho mọi module khi tạo, nên toàn bộ module hiện có (kể cả các trang điều
-- hướng thật như Dashboard/Users/...) đều đang mang giá trị sai. Đưa về đúng "Menu" (1) cho
-- mọi module đã tồn tại để giữ nguyên hành vi Sidebar hiện tại; từ nay module_type mới thực
-- sự điều khiển được việc có hiện trên Sidebar hay không (xem moduleModel.create/update).
UPDATE modules SET module_type = 1;
