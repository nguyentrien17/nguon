import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui';
import { RECORD_STATUS } from '@shared/constants.json';

/** Trạng thái của module/action: Hoạt động / Ngưng / Đã lưu trữ. */
export default function RecordStatusBadge({ status }) {
    const { t } = useTranslation();
    if (status === RECORD_STATUS.ARCHIVED) return <Badge tone="neutral">{t('moduleActions.status.archived')}</Badge>;
    if (status === RECORD_STATUS.ACTIVE) return <Badge tone="success">{t('moduleActions.status.active')}</Badge>;
    return <Badge tone="danger">{t('moduleActions.status.inactive')}</Badge>;
}
