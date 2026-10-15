import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';

/**
 * Trạng thái "không có dữ liệu". `icon` tuỳ chọn (component lucide), `action` tuỳ chọn để đặt
 * một nút gợi ý bước tiếp theo (vd <Button>Tạo mới</Button>).
 */
export default function EmptyState({ message, icon: Icon = Inbox, action }) {
    const { t } = useTranslation();
    return (
        <div className="empty-state">
            <Icon size={32} aria-hidden="true" />
            <p>{message || t('common.noData')}</p>
            {action}
        </div>
    );
}
