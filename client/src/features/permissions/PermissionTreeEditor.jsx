import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { Select, TriStateCheckbox } from '@/components/form';
import { PERMISSION_PRESETS } from './permissionPresets';
import { createModuleTree, grantKey, groupState, presetSelection, toggleGrant, toggleModuleGrants } from './permissionTree';

/**
 * Cây module -> action để tích chọn quyền cho một role, kèm thanh áp preset.
 * `value`: Set khoá quyền ('moduleId_actionId'); `onChange(nextSet)`.
 */
export default function PermissionTreeEditor({ modules, actions, value, onChange }) {
    const { t } = useTranslation();
    const tree = useMemo(() => createModuleTree(modules, actions), [modules, actions]);
    const [expanded, setExpanded] = useState(() => new Set(modules.map((m) => m.id)));
    const [presetKey, setPresetKey] = useState(PERMISSION_PRESETS[0].key);

    const toggleExpanded = (id) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const applyPreset = () => {
        const preset = PERMISSION_PRESETS.find((p) => p.key === presetKey);
        if (preset) onChange(presetSelection(actions, preset.actionCodes));
    };

    const renderAction = (a, depth) => (
        <tr key={`a-${a.id}`} className="tree-row tree-row-action">
            <td>
                <div className="tree-cell" style={{ paddingLeft: depth * 22 + 22 }}>
                    <span className="perm-code perm-code-action">{a.action_code}</span>
                </div>
            </td>
            <td>{a.action_name}</td>
            <td className="tree-muted">—</td>
            <td className="perm-check-cell">
                <input
                    type="checkbox"
                    checked={value.has(grantKey(a.module_id, a.id))}
                    onChange={() => onChange(toggleGrant(value, tree, a.module_id, a.id))}
                    aria-label={`${a.action_code} — ${a.action_name}`}
                />
            </td>
        </tr>
    );

    const renderModule = (m, depth) => {
        const isOpen = expanded.has(m.id);
        const keys = tree.keysOf(m);
        const state = groupState(value, keys);
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
                        <TriStateCheckbox
                            checked={state.checked}
                            indeterminate={state.indeterminate}
                            onChange={() => onChange(toggleModuleGrants(value, keys))}
                            aria-label={m.module_name}
                        />
                    </td>
                </tr>
                {isOpen && tree.childrenOf(m.id).map((c) => renderModule(c, depth + 1))}
                {isOpen && tree.actionsOf(m.id).map((a) => renderAction(a, depth + 1))}
            </Fragment>
        );
    };

    return (
        <>
            <div className="preset-bar">
                <Select
                    id="permission-preset"
                    value={presetKey}
                    onChange={setPresetKey}
                    placeholder={false}
                    options={PERMISSION_PRESETS.map((p) => ({ value: p.key, label: t(`permissions.presets.${p.key}`) }))}
                    aria-label={t('permissions.applyPreset')}
                />
                <Button onClick={applyPreset}>{t('permissions.applyPreset')}</Button>
            </div>
            <div className="table-wrap perm-tree-wrap">
                <table className="data-table tree-table">
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
            </div>
        </>
    );
}
