import { describe, expect, it, vi } from 'vitest';
import { importWithReload } from './lazyWithRetry';

describe('importWithReload — chunk cũ bị xoá sau deploy', () => {
    it('tải được -> trả module, xoá cờ reload', async () => {
        sessionStorage.setItem('chunk-reload-at', String(Date.now()));
        const mod = { default: 'Page' };
        await expect(importWithReload(() => Promise.resolve(mod), vi.fn())).resolves.toBe(mod);
        expect(sessionStorage.getItem('chunk-reload-at')).toBeNull();
    });

    it('lỗi lần đầu -> reload trang MỘT lần', async () => {
        const reload = vi.fn();
        const pending = importWithReload(() => Promise.reject(new Error('Failed to fetch dynamically imported module')), reload);
        await Promise.resolve();
        await Promise.resolve();
        expect(reload).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem('chunk-reload-at')).not.toBeNull();
        void pending; // promise không bao giờ xong — trang đang tải lại
    });

    it('vẫn lỗi ngay sau khi vừa reload -> ném lỗi (không lặp reload vô hạn)', async () => {
        sessionStorage.setItem('chunk-reload-at', String(Date.now()));
        const reload = vi.fn();
        await expect(importWithReload(() => Promise.reject(new Error('offline')), reload)).rejects.toThrow('offline');
        expect(reload).not.toHaveBeenCalled();
    });
});
