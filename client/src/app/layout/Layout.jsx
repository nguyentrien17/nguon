import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { useAuth } from '@/core/auth/AuthContext';

function initials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((p) => p[0]?.toUpperCase())
        .join('');
}

export default function Layout() {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
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
                        aria-label="Toggle menu"
                    >
                        <Menu size={20} />
                    </button>

                    <div className="app-topbar-right">
                        <LanguageSwitcher />
                        <div className="app-user">
                            <Link to="/profile" className="app-user-link" title={t('profile.title')}>
                                <span className="avatar-circle">{initials(user?.full_name)}</span>
                                <span className="app-user-name">{user?.full_name}</span>
                            </Link>
                            <button type="button" onClick={logout} title={t('nav.logout')}>
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </header>
                <main className="app-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
