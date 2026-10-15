import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TriStateCheckbox } from '@/components/form';
import { createModuleTree, grantKey, groupState, selectionFromDetails } from './permissionTree';

/**
 * Bảng CHỈ ĐỌC các quyền một role đang có, hiện ngay dưới dòng role. Chỉ hiện module có ít nhất
 * một quyền được cấp.
 */
export default function RoleGrantsTable({ role, modules, actions }) {
    const { t } = useTranslation();
    const tree = useMemo(() => createModuleTree(modules, actions), [modules, actions]);
    const granted = useMemo(() => selectionFromDetails(role.details), [role.details]);
    const [expanded, setExpanded] = useState(() => new Set(modules.map((m) => m.id)));

    if (role.details.length === 0) {
        return <div className="perm-grants-empty">{t('permissions.noGrants')}</div>;
    }

    const toggleExpanded = (id) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const renderModule = (m, depth) => {
        const keys = tree.keysOf(m);
        const state = groupState(granted, keys);
        if (state.count === 0) return null;
        const isOpen = expanded.has(m.id);

        return (
            <Fragment key={m.id}>
                <tr className="tree-row tree-row-module">
                    <td>
                        <div className="tree-cell" style={{ paddingLeft: depth * 22 }}>
                            <button type="button" className="tree-toggle" onClick={() => toggleExpanded(m.id)} aria-expanded={isOpen}>
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <span className="perm-code perm-code-module">{m.module_code}</span>
                        </div>
                    </td>
                    <td>{m.module_name}</td>
                    <td className="tree-muted">{m.module_href || '—'}</td>
                    <td className="perm-check-cell">
                        <TriStateCheckbox checked={state.checked} indeterminate={state.indeterminate} disabled />
                    </td>
                </tr>
                {isOpen && tree.childrenOf(m.id).map((c) => renderModule(c, depth + 1))}
                {isOpen &&
                    tree
                        .actionsOf(m.id)
                        .filter((a) => granted.has(grantKey(m.id, a.id)))
                        .map((a) => (
                            <tr key={`ga-${a.id}`} className="tree-row tree-row-action">
                                <td>
                                    <div className="tree-cell" style={{ paddingLeft: (depth + 1) * 22 + 22 }}>
                                        <span className="perm-code perm-code-action">{a.action_code}</span>
                                    </div>
                                </td>
                                <td>{a.action_name}</td>
                                <td className="tree-muted">—</td>
                                <td className="perm-check-cell">
                                    <input type="checkbox" checked disabled readOnly />
                                </td>
                            </tr>
                        ))}
            </Fragment>
        );
    };

    return (
        <table className="data-table tree-table perm-grants-table">
            <thead>
                <tr>
                    <th>{t('permissions.columns.code')}</th>
                    <th>{t('permissions.columns.name')}</th>
                    <th>{t('permissions.columns.path')}</th>
                    <th>{t('permissions.columns.grant')}</th>
                </tr>
            </thead>
            <tbody>{tree.roots.map((m) => renderModule(m, 0))}</tbody>
        </table>
    );
}
