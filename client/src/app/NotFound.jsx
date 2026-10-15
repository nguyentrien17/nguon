import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
    const { t } = useTranslation();
    return (
        <div className="page">
            <h1>404</h1>
            <p>{t('common.notFound')}</p>
            <Link to="/dashboard">{t('common.backToDashboard')}</Link>
        </div>
    );
}
