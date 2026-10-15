import { Suspense, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/ui/Avatar';
import ErrorBoundary from '@/core/errors/ErrorBoundary';
import { useSession } from '@/core/auth/SessionContext';

export default function Layout() {
    const { t } = useTranslation();
    const { user, logout } = useSession();
    const { pathname } = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="app-layout">
            <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
            {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

            <div className="app-main">
                <header className="app-topbar">
                    <button
                        type="button"
                        className="menu-toggle"
                        onClick={() => setSidebarOpen((s) => !s)}
                        aria-label={t('common.toggleMenu')}
                        aria-expanded={sidebarOpen}
                    >
                        <Menu size={20} />
                    </button>

                    <div className="app-topbar-right">
                        <LanguageSwitcher />
                        <div className="app-user">
                            <Link to="/profile" className="app-user-link" title={t('profile.title')}>
                                <Avatar src={user?.avatar} name={user?.full_name} size={32} />
                                <span className="app-user-name">{user?.full_name}</span>
                            </Link>
                            <button type="button" onClick={logout} title={t('nav.logout')} aria-label={t('nav.logout')}>
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </header>
                <main className="app-content">
                    {/* Boundary + Suspense riêng cho nội dung trang: một trang lỗi hoặc đang tải
                        chunk không làm mất menu/topbar; chuyển sang trang khác là tự hồi phục. */}
                    <ErrorBoundary resetKey={pathname}>
                        <Suspense
                            fallback={
                                <div className="route-fallback">
                                    <Spinner size={28} />
                                </div>
                            }
                        >
                            <Outlet />
                        </Suspense>
                    </ErrorBoundary>
                </main>
            </div>
        </div>
    );
}
