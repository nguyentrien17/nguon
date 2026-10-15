import { lazy } from 'react';

const RELOAD_FLAG = 'chunk-reload-at';
const RELOAD_WINDOW_MS = 10 * 1000;

/**
 * Như React.lazy, nhưng tự tải lại trang MỘT lần khi không tải được chunk của trang.
 *
 * Vì sao: mỗi lần deploy, Vite đổi tên file chunk (hash). Người đang mở bản cũ bấm sang trang
 * khác sẽ yêu cầu file chunk cũ đã bị xoá -> lỗi "Failed to fetch dynamically imported module".
 * Tải lại trang là lấy được index.html + chunk mới.
 *
 * Chỉ reload một lần trong RELOAD_WINDOW_MS (đánh dấu ở sessionStorage) để không lặp vô hạn
 * nếu lỗi do nguyên nhân khác (mất mạng, server chết) — lần sau lỗi được ném ra cho ErrorBoundary.
 */
export default function lazyWithRetry(importer) {
    return lazy(() => importWithReload(importer));
}

/** Phần logic của lazyWithRetry, tách riêng để test. `reload` mặc định là window.location.reload. */
export async function importWithReload(importer, reload = () => window.location.reload()) {
    try {
        const mod = await importer();
        safeSession(() => sessionStorage.removeItem(RELOAD_FLAG));
        return mod;
    } catch (err) {
        const last = Number(safeSession(() => sessionStorage.getItem(RELOAD_FLAG)) || 0);
        if (Date.now() - last > RELOAD_WINDOW_MS) {
            safeSession(() => sessionStorage.setItem(RELOAD_FLAG, String(Date.now())));
            reload();
            // Trang sắp tải lại — trả về promise không bao giờ xong để Suspense giữ fallback.
            return new Promise(() => {});
        }
        throw err;
    }
}

function safeSession(fn) {
    try {
        return fn();
    } catch {
        return null; // sessionStorage bị chặn (chế độ riêng tư...) — bỏ qua
    }
}
