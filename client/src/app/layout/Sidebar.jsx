import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldCheck, ScrollText, Boxes, Circle, ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '@/core/permissions/PermissionsContext';
import { useModules } from '@/core/permissions/ModulesContext';
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
    // modules do ModulesProvider nạp sẵn mỗi khi có phiên mới — trước đây Sidebar tự gọi /modules
    // lần thứ hai với cùng dữ liệu.
    const { canOpenModule } = usePermissions();
    const { modules } = useModules();
    // Lưu nhóm đang THU GỌN (mặc định trống = mở hết) để không phải khởi tạo lại khi modules về.
    const [collapsed, setCollapsed] = useState(new Set());

    const visibleModules = modules.filter(
        // Cùng quy tắc với ProtectedRoute — menu không hiện mục mà bấm vào lại bị đẩy về Dashboard.
        (m) => m.module_type === MODULE_TYPE.MENU && canOpenModule(m.module_code)
    );
    const rootModules = visibleModules.filter((m) => !m.module_parent_id);
    const childrenOf = (parentId) => visibleModules.filter((m) => m.module_parent_id === parentId);

    const toggleExpanded = (id) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const renderModule = (m, depth) => {
        const children = childrenOf(m.id);
        const hasChildren = children.length > 0;
        const isOpen = !collapsed.has(m.id);
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
                            aria-label={isOpen ? t('common.collapse') : t('common.expand')}
                            aria-expanded={isOpen}
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
