import i18n from '@/i18n';

// Dùng i18n instance (không phải hook) để Spinner hiển thị được ở mọi nơi, kể cả ngoài provider
// (fallback của Suspense gốc).
export default function Spinner({ size = 18, className = '' }) {
    return <span className={`spinner ${className}`} style={{ width: size, height: size }} role="status" aria-label={i18n.t('common.loading')} />;
}
