/**
 * Cho trình duyệt tải xuống một Blob (vd file Excel trả về từ API với responseType: 'blob').
 *
 *   downloadFile(await exportUsers(params), `users-${Date.now()}.xlsx`);
 */
export function downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}
