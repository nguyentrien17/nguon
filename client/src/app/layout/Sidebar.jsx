import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldCheck, ScrollText, Boxes, Circle, ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/core/auth/AuthContext';
import axiosClient from '@/core/api/axiosClient';
import { MODULE_CODE, MODULE_TYPE } from '@shared/constants.json';
import { MODULE_ICON_MAP } from '@/constants/moduleIcons';

const ICONS = {
    [MODULE_CODE.DASHBOARD]: LayoutDashboard,
    [MODULE_CODE.USER]: Users,
    [MODULE_CODE.PERMISSION]: ShieldCheck,
    [MODULE_CODE.AUDIT]: ScrollText,
    [MODULE_CODE.MODULE_ACTION]: Boxes,
};

export default function Sidebar({ open, onNavigate }) {
    const { t } = useTranslation();
    const { canAccessModule } = useAuth();
    const [modules, setModules] = useState([]);
    const [expanded, setExpanded] = useState(new Set());

    useEffect(() => {
        axiosClient
            .get('/modules')
            .then(({ data }) => {
                setModules(data.data);
                setExpanded(new Set(data.data.map((m) => m.id)));
            })
            .catch(() => setModules([]));
    }, []);

    const visibleModules = modules.filter(
        (m) => m.module_type === MODULE_TYPE.MENU && canAccessModule(m.module_code)
    );
    const rootModules = visibleModules.filter((m) => !m.module_parent_id);
    const childrenOf = (parentId) => visibleModules.filter((m) => m.module_parent_id === parentId);

    const toggleExpanded = (id) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const renderModule = (m, depth) => {
        const children = childrenOf(m.id);
        const hasChildren = children.length > 0;
        const isOpen = expanded.has(m.id);
        const Icon = MODULE_ICON_MAP[m.module_icon] || ICONS[m.module_code] || Circle;

        return (
            <div key={m.id} className="sidebar-group">
                <div className="sidebar-row" style={{ paddingLeft: depth * 14 }}>
                    <NavLink
                        to={m.module_href || '#'}
                        onClick={(e) => {
                            if (!m.module_href) e.preventDefault();
                            onNavigate?.();
                        }}
                        className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                    >
                        <Icon size={depth > 0 ? 15 : 18} />
                        <span>{m.module_name}</span>
                    </NavLink>
                    {hasChildren && (
                        <button
                            type="button"
                            className="sidebar-toggle"
                            onClick={() => toggleExpanded(m.id)}
                            aria-label={isOpen ? 'Collapse' : 'Expand'}
                        >
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    )}
                </div>
                {hasChildren && isOpen && (
                    <div className="sidebar-children">{children.map((c) => renderModule(c, depth + 1))}</div>
                )}
            </div>
        );
    };

    return (
        <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
            <div className="sidebar-brand">
                <ShieldCheck size={20} />
                <span>{t('app.title')}</span>
            </div>
            <nav>{rootModules.map((m) => renderModule(m, 0))}</nav>
        </aside>
    );
}
