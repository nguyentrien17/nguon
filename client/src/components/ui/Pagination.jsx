import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getPageItems } from './paginationUtils';
import './ui.css';

/**
 * Thanh phân trang. Nhận thẳng object `pagination` mà API trả về
 * ({ page, totalPages, total }) — xem docs/api-conventions.md.
 *
 *   <Pagination pagination={pagination} onChange={goToPage} disabled={loading} />
 *
 * Ẩn hẳn khi chỉ có 1 trang (giữ hành vi cũ).
 */
export default function Pagination({ pagination, onChange, disabled = false, siblings = 1 }) {
    const { t } = useTranslation();
    const { page = 1, totalPages = 1, total } = pagination || {};
    if (totalPages <= 1) return null;

    const go = (p) => {
        if (!disabled && p >= 1 && p <= totalPages && p !== page) onChange(p);
    };

    return (
        <nav className="pagination" aria-label={t('common.pagination')}>
            <button type="button" onClick={() => go(page - 1)} disabled={disabled || page <= 1} aria-label={t('common.previous')}>
                <ChevronLeft size={14} aria-hidden="true" />
            </button>
            {getPageItems(page, totalPages, siblings).map((item) =>
                typeof item === 'number' ? (
                    <button
                        key={item}
                        type="button"
                        className={item === page ? 'active' : ''}
                        aria-current={item === page ? 'page' : undefined}
                        disabled={disabled}
                        onClick={() => go(item)}
                    >
                        {item}
                    </button>
                ) : (
                    <span key={item} className="pagination-ellipsis" aria-hidden="true">
                        …
                    </span>
                )
            )}
            <button type="button" onClick={() => go(page + 1)} disabled={disabled || page >= totalPages} aria-label={t('common.next')}>
                <ChevronRight size={14} aria-hidden="true" />
            </button>
            {typeof total === 'number' && <span className="pagination-total">{t('common.totalItems', { count: total })}</span>}
        </nav>
    );
}
