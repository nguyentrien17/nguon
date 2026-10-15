import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import ActionGuard from '@/core/permissions/ActionGuard';
import { Button, ConfirmDialog } from '@/components/ui';
import { Select } from '@/components/form';
import { useToast } from '@/app/providers/ToastContext';
import { MODULE_CODE, ACTION_CODE, RECORD_STATUS } from '@shared/constants.json';
import { getErrorMessage } from '@/core/errors/errorMessage';
import { createModuleTree } from '@/lib/moduleTree';
import ModuleTreeTable from './ModuleTreeTable';
import InsightsPanel from './InsightsPanel';
import ModuleFormModal from './ModuleFormModal';
import ActionFormModal from './ActionFormModal';
import CloneModuleModal from './CloneModuleModal';
import { filterModuleTree } from './moduleFilter';
import * as api from './moduleActionApi';

const EMPTY_INSIGHTS = { unusedActions: [], emptyModules: [], unusedRoles: [], actionRoleMap: {} };

// Trang cây Module & Action: lọc, xem cảnh báo cấu hình, mở các form và chạy thao tác trên dòng.
// Bảng ở ModuleTreeTable, form ở *FormModal / CloneModuleModal, API ở moduleActionApi.
export default function ModuleActions() {
    const { t } = useTranslation();
    const toast = useToast();

    const [modules, setModules] = useState([]);
    const [actions, setActions] = useState([]);
    const [insights, setInsights] = useState(EMPTY_INSIGHTS);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [expanded, setExpanded] = useState(new Set());

    // Hộp thoại đang mở — null = đóng.
    const [moduleForm, setModuleForm] = useState(null); // { module: null|Module, parentId }
    const [actionForm, setActionForm] = useState(null); // { action: null|Action, moduleId }
    const [cloneTarget, setCloneTarget] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null); // { kind: 'module'|'action', record }
    const [deleting, setDeleting] = useState(false);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [modulesRes, actionsRes, insightsRes] = await Promise.all([api.listModules(), api.listActions(), api.getInsights()]);
            setModules(modulesRes.data);
            setActions(actionsRes.data);
            setExpanded(new Set(modulesRes.data.map((m) => m.id)));
            setInsights(insightsRes.data);
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tree = useMemo(() => createModuleTree(modules, actions), [modules, actions]);
    const filter = useMemo(() => filterModuleTree(modules, tree, { query: search, status: statusFilter }), [modules, tree, search, statusFilter]);

    const toggleExpand = (id) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    // Thao tác ngắn trên một dòng: gọi API, báo lỗi nếu có, nạp lại cây.
    const mutate = async (request, successMessage) => {
        try {
            const result = await request();
            if (successMessage) toast.success(successMessage);
            loadAll();
            return result;
        } catch (err) {
            toast.error(getErrorMessage(err, t));
            return null;
        }
    };

    const nextStatus = (record) => (record.status === RECORD_STATUS.ACTIVE ? RECORD_STATUS.INACTIVE : RECORD_STATUS.ACTIVE);

    const handlers = {
        onCreateChild: (m) => setModuleForm({ module: null, parentId: m.id }),
        onEditModule: (m) => setModuleForm({ module: m, parentId: m.module_parent_id }),
        onCreateAction: (m) => setActionForm({ action: null, moduleId: m.id }),
        onEditAction: (a) => setActionForm({ action: a, moduleId: a.module_id }),
        onClone: (m) => setCloneTarget(m),
        onScaffold: async (m) => {
            const res = await mutate(() => api.scaffoldActions(m.id));
            if (!res) return;
            if (res.data.created.length > 0) toast.success(`${t('moduleActions.scaffoldSuccess')}: ${res.data.created.join(', ')}`);
            else toast.info(t('moduleActions.scaffoldNoop'));
        },
        onToggleModuleStatus: (m) => mutate(() => api.setModuleStatus(m, nextStatus(m))),
        onArchiveModule: (m) => mutate(() => api.archiveModule(m.id)),
        onRestoreModule: (m) => mutate(() => api.restoreModule(m.id)),
        onDeleteModule: (m) => setConfirmDelete({ kind: 'module', record: m }),
        onToggleActionStatus: (a) => mutate(() => api.setActionStatus(a, nextStatus(a))),
        onArchiveAction: (a) => mutate(() => api.archiveAction(a.id)),
        onRestoreAction: (a) => mutate(() => api.restoreAction(a.id)),
        onDeleteAction: (a) => setConfirmDelete({ kind: 'action', record: a }),
    };

    const runDelete = async () => {
        const { kind, record } = confirmDelete;
        setDeleting(true);
        await mutate(() => (kind === 'module' ? api.deleteModule(record.id) : api.deleteAction(record.id)), t('moduleActions.deleted'));
        setDeleting(false);
        setConfirmDelete(null);
    };

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1>{t('moduleActions.title')}</h1>
                    <p className="page-subtitle">{t('moduleActions.subtitle')}</p>
                </div>
                <ActionGuard module={MODULE_CODE.MODULE_ACTION} action={ACTION_CODE.CREATE}>
                    <Button variant="primary" icon={Plus} onClick={() => setModuleForm({ module: null, parentId: null })}>
                        {t('moduleActions.createRootModule')}
                    </Button>
                </ActionGuard>
            </div>

            <InsightsPanel insights={insights} />

            {/* Lọc tức thì trên dữ liệu đã tải (không gọi API) nên không dùng SearchBar có nút Tìm. */}
            <div className="search-bar">
                <div className="input-with-icon search-input">
                    <Search size={16} className="input-icon-static" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder={t('moduleActions.search')}
                        aria-label={t('moduleActions.search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select
                    id="module-status-filter"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    placeholder={t('moduleActions.allStatuses')}
                    aria-label={t('moduleActions.columns.status')}
                    options={[
                        { value: String(RECORD_STATUS.ACTIVE), label: t('moduleActions.status.active') },
                        { value: String(RECORD_STATUS.INACTIVE), label: t('moduleActions.status.inactive') },
                        { value: String(RECORD_STATUS.ARCHIVED), label: t('moduleActions.status.archived') },
                    ]}
                />
            </div>

            <ModuleTreeTable
                tree={tree}
                filter={filter}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                actionRoleMap={insights.actionRoleMap}
                handlers={handlers}
                loading={loading}
            />

            {moduleForm && (
                <ModuleFormModal module={moduleForm.module} parentId={moduleForm.parentId} onClose={() => setModuleForm(null)} onSaved={loadAll} />
            )}
            {actionForm && (
                <ActionFormModal action={actionForm.action} moduleId={actionForm.moduleId} onClose={() => setActionForm(null)} onSaved={loadAll} />
            )}
            {cloneTarget && <CloneModuleModal module={cloneTarget} onClose={() => setCloneTarget(null)} onSaved={loadAll} />}

            <ConfirmDialog
                open={!!confirmDelete}
                title={t('moduleActions.delete')}
                message={confirmDelete?.kind === 'action' ? t('moduleActions.confirmDeleteAction') : t('moduleActions.confirmDeleteModule')}
                confirmLabel={t('moduleActions.delete')}
                cancelLabel={t('moduleActions.form.cancel')}
                tone="danger"
                loading={deleting}
                onConfirm={runDelete}
                onCancel={() => setConfirmDelete(null)}
            />
        </div>
    );
}
