function formatValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
}

// Compares `before` (existing record) against `changes` (fields being applied) and
// returns a human-readable "field: old → new" summary for fields that actually changed.
//
// Thuần kỹ thuật: không biết tên bảng hay tên field cụ thể nào, dùng được cho mọi domain.
// Phiên bản dành riêng cho RBAC (buildPermissionDiff) nằm ở features/permissions/permissionDiff.js.
function buildFieldDiff(before, changes, labels = {}) {
    const parts = [];
    for (const [key, newValue] of Object.entries(changes)) {
        if (newValue === undefined) continue;
        const oldValue = before[key];
        if (formatValue(oldValue) === formatValue(newValue)) continue;
        const label = labels[key] || key;
        parts.push(`${label}: '${formatValue(oldValue)}' → '${formatValue(newValue)}'`);
    }
    return parts.length > 0 ? parts.join('; ') : 'No changes';
}

module.exports = { buildFieldDiff };
