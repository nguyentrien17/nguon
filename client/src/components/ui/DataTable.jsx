import Spinner from './Spinner';
import EmptyState from './EmptyState';
import './ui.css';

/**
 * Bảng dữ liệu chuẩn: header, các dòng, overlay khi đang tải, trạng thái rỗng.
 *
 *   const columns = [
 *       { key: 'username', header: t('users.columns.username') },
 *       { key: 'status', header: t('users.columns.status'), render: (u) => <Badge ...>{...}</Badge> },
 *       { key: 'actions', header: '', className: 'actions-cell', render: (u) => <IconButton .../> },
 *   ];
 *   <DataTable columns={columns} rows={rows} loading={loading} emptyMessage={t('users.empty')} />
 *
 * Cột:
 *   - key        định danh cột; nếu không có `render` thì hiển thị row[key] (null/'' -> '—')
 *   - header     nội dung ô tiêu đề
 *   - render     (row, index) => ReactNode, cho ô tuỳ biến
 *   - className  class cho <td> (vd 'actions-cell', 'audit-detail-cell')
 *   - headerClassName  class cho <th>
 *
 * `rowKey` mặc định là 'id'; truyền hàm (row) => key nếu dữ liệu không có id.
 */
export default function DataTable({ columns, rows, rowKey = 'id', loading = false, emptyMessage, className = '' }) {
    const getKey = typeof rowKey === 'function' ? rowKey : (row) => row[rowKey];
    const isEmpty = !loading && rows.length === 0;

    return (
        <div className="table-wrap" aria-busy={loading || undefined}>
            <table className={['data-table', className].filter(Boolean).join(' ')}>
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th key={col.key} className={col.headerClassName} scope="col">
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={getKey(row)}>
                            {columns.map((col) => (
                                <td key={col.key} className={col.className}>
                                    {col.render ? col.render(row, index) : formatCell(row[col.key])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {loading && (
                <div className="table-overlay">
                    <Spinner size={24} />
                </div>
            )}
            {isEmpty && <EmptyState message={emptyMessage} />}
        </div>
    );
}

function formatCell(value) {
    return value === null || value === undefined || value === '' ? '—' : value;
}
