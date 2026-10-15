import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/app/providers/ToastContext';
import usePagedList from './usePagedList';

const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;
const page = (n) => ({ data: [{ id: n }], pagination: { page: n, limit: 10, total: 100, totalPages: 10 } });

function deferred() {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
}

describe('usePagedList', () => {
    it('tải trang 1 khi mount; filter rỗng không gửi lên', async () => {
        const fetchPage = vi.fn((params) => Promise.resolve(page(params.page)));
        const { result } = renderHook(() => usePagedList(fetchPage, { initialFilters: { search: '' } }), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(fetchPage).toHaveBeenCalledWith({ page: 1, limit: 10 });
        expect(result.current.rows).toEqual([{ id: 1 }]);
    });

    it('race: response trang 2 về SAU trang 3 thì bị bỏ qua', async () => {
        const pending = {};
        const fetchPage = vi.fn((params) => {
            pending[params.page] = deferred();
            return pending[params.page].promise;
        });
        const { result } = renderHook(() => usePagedList(fetchPage), { wrapper });
        await act(async () => pending[1].resolve(page(1)));

        act(() => {
            result.current.goToPage(2);
            result.current.goToPage(3);
        });
        await act(async () => pending[3].resolve(page(3)));
        await act(async () => pending[2].resolve(page(2))); // về muộn

        expect(result.current.pagination.page).toBe(3);
        expect(result.current.rows).toEqual([{ id: 3 }]);
        expect(result.current.loading).toBe(false);
    });

    it('applyFilters về trang 1 với bộ lọc mới; goToPage giữ bộ lọc đã áp dụng', async () => {
        const fetchPage = vi.fn((params) => Promise.resolve(page(params.page)));
        const { result } = renderHook(() => usePagedList(fetchPage, { initialFilters: { search: '' } }), { wrapper });
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(() => result.current.applyFilters({ search: 'ann' }));
        await act(() => result.current.goToPage(4));
        expect(fetchPage).toHaveBeenLastCalledWith({ page: 4, limit: 10, search: 'ann' });
    });
});
