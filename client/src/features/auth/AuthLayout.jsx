import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

/**
 * Khung chung của các trang chưa đăng nhập (đăng nhập, quên / đặt lại mật khẩu): thanh trên cùng
 * có logo + đổi ngôn ngữ, panel giới thiệu bên trái, nội dung (form) bên phải.
 *
 *   <AuthLayout heroTitle={t('login.heroTitle')} heroSubtitle={t('login.heroSubtitle')}>
 *       <form className="login-panel-form">...</form>
 *   </AuthLayout>
 *
 * `children` phải là phần tử mang class "login-panel-form" (form hoặc div).
 */
export default function AuthLayout({ heroTitle, heroSubtitle, children }) {
    const { t } = useTranslation();
    return (
        <div className="login-page">
            <div className="login-shell">
                <div className="login-topbar">
                    <div className="login-logo">
                        <ShieldCheck size={22} aria-hidden="true" />
                        <span>{t('app.title')}</span>
                    </div>
                    <LanguageSwitcher />
                </div>

                <div className="login-panels">
                    <div className="login-panel-hero">
                        <h1>{heroTitle}</h1>
                        <p>{heroSubtitle}</p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
