import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/app/providers/ToastContext';
import { getErrorMessage } from '@/core/errors/errorMessage';

/**
 * State + tải dữ liệu cho một trang danh sách có phân trang và bộ lọc.
 *
 *   const list = usePagedList(
 *       (params) => axiosClient.get('/users', { params }).then((r) => r.data),
 *       { limit: 10, initialFilters: { search: '' } }
 *   );
 *   <SearchBar ... onSearch={(search) => list.applyFilters({ search })} />
 *   <DataTable rows={list.rows} loading={list.loading} ... />
 *   <Pagination pagination={list.pagination} onChange={list.goToPage} disabled={list.loading} />
 *   // sau khi tạo/sửa/xoá:  list.reload();
 *
 * `fetchPage(params)` nhận { page, limit, ...filters } (filter rỗng đã bị loại bỏ) và phải trả về
 * đúng shape API: { data: [...], pagination: { page, limit, total, totalPages } }.
 *
 * Xử lý sẵn:
 *   - Lỗi -> toast.error với message đã dịch; danh sách cũ được giữ nguyên.
 *   - Race: bấm trang 2 rồi trang 3 thật nhanh, response của trang 2 về SAU sẽ bị bỏ qua thay
 *     vì ghi đè lên trang 3 đang hiển thị.
 *   - Phân trang dùng bộ lọc ĐÃ ÁP DỤNG, không phải chữ đang gõ dở trong ô tìm kiếm.
 */
export default function usePagedList(fetchPage, { limit = 10, initialFilters = {}, autoLoad = true } = {}) {
    const { t } = useTranslation();
    const toast = useToast();

    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit, total: 0, totalPages: 1 });
    const [filters, setFilters] = useState(initialFilters);
    const [loading, setLoading] = useState(autoLoad);

    // fetchPage thường là hàm inline — giữ trong ref để load() không đổi tham chiếu mỗi render.
    const fetchRef = useRef(fetchPage);
    useEffect(() => {
        fetchRef.current = fetchPage;
    });
    const requestSeq = useRef(0);
    const current = useRef({ page: 1, filters: initialFilters });

    const load = useCallback(
        async (page, nextFilters) => {
            const seq = ++requestSeq.current;
            current.current = { page, filters: nextFilters };
            setLoading(true);
            try {
                const params = { page, limit, ...compact(nextFilters) };
                const result = await fetchRef.current(params);
                if (seq !== requestSeq.current) return; // đã có request mới hơn
                setRows(result.data);
                setPagination(result.pagination);
            } catch (err) {
                if (seq !== requestSeq.current) return;
                toast.error(getErrorMessage(err, t));
            } finally {
                if (seq === requestSeq.current) setLoading(false);
            }
        },
        [limit, toast, t]
    );

    useEffect(() => {
        // Lần tải đầu tiên khi trang mở — setState bên trong load() là chủ đích.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (autoLoad) load(1, current.current.filters);
        // Chỉ chạy một lần lúc mount; đổi filter đi qua applyFilters().
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const goToPage = useCallback((page) => load(page, current.current.filters), [load]);

    const applyFilters = useCallback(
        (patch) => {
            const next = { ...current.current.filters, ...patch };
            setFilters(next);
            return load(1, next);
        },
        [load]
    );

    // Nạp lại trang hiện tại (sau khi tạo/sửa/xoá). Nếu trang hiện tại trống sau khi xoá dòng
    // cuối, API trả về trang rỗng — caller có thể goToPage(page - 1) nếu muốn.
    const reload = useCallback(() => load(current.current.page, current.current.filters), [load]);

    return { rows, pagination, filters, loading, goToPage, applyFilters, reload };
}

function compact(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined));
}
