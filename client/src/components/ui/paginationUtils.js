/**
 * Danh sách nút trang cần hiển thị: luôn có trang đầu, trang cuối và `siblings` trang hai bên
 * trang hiện tại; khoảng bị bỏ được thay bằng 'ellipsis-start' / 'ellipsis-end'.
 *
 *   getPageItems(6, 20) -> [1, 'ellipsis-start', 5, 6, 7, 'ellipsis-end', 20]
 *
 * Trước đây mỗi trang danh sách render MỌI số trang — audit log 500 trang là 500 nút.
 * Tách thành hàm thuần (không JSX) để test được và không vi phạm react-refresh/only-export-components.
 */
export function getPageItems(page, totalPages, siblings = 1) {
    if (totalPages <= 1) return [1];

    // Đủ ít trang thì hiện hết: 2 đầu/cuối + 2 ô ellipsis + (2*siblings + 1) trang giữa.
    if (totalPages <= 2 * siblings + 5) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const current = Math.min(Math.max(page, 1), totalPages);
    let start = Math.max(2, current - siblings);
    let end = Math.min(totalPages - 1, current + siblings);

    // Giữ số ô cố định khi đang ở gần hai đầu, để thanh phân trang không co giãn khi bấm.
    if (current - siblings <= 3) {
        start = 2;
        end = 3 + 2 * siblings;
    } else if (current + siblings >= totalPages - 2) {
        start = totalPages - 2 - 2 * siblings;
        end = totalPages - 1;
    }

    const items = [1];
    if (start > 2) items.push('ellipsis-start');
    for (let p = start; p <= end; p += 1) items.push(p);
    if (end < totalPages - 1) items.push('ellipsis-end');
    items.push(totalPages);
    return items;
}
