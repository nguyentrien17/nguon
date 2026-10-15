import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import Button from './Button';
import './ui.css';

/**
 * Ô tìm kiếm + nút "Tìm" — submit bằng Enter hoặc bấm nút. `children` (nếu có) được đặt sau,
 * cùng hàng: dùng cho các bộ lọc <select> đi kèm.
 *
 *   <SearchBar value={search} onChange={setSearch} onSearch={() => applyFilters({ search })}
 *              placeholder={t('users.search')} />
 *
 * Không có ô tìm kiếm (chỉ có bộ lọc) thì dùng <div className="search-bar"> trực tiếp.
 */
export default function SearchBar({ value, onChange, onSearch, placeholder, disabled = false, children }) {
    const { t } = useTranslation();

    const handleSubmit = (e) => {
        e.preventDefault();
        onSearch(value);
    };

    return (
        <form className="search-bar" onSubmit={handleSubmit} role="search">
            <div className="input-with-icon search-input">
                <Search size={16} className="input-icon-static" aria-hidden="true" />
                <input
                    type="text"
                    placeholder={placeholder}
                    aria-label={placeholder || t('common.search')}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
            <Button type="submit" variant="secondary" disabled={disabled}>
                {t('common.search')}
            </Button>
            {children}
        </form>
    );
}
