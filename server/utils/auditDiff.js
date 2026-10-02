function formatValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
}

// Compares `before` (existing record) against `changes` (fields being applied) and
// returns a human-readable "field: old → new" summary for fields that actually changed.
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

// Compares two (module_id, action_id) pair lists and returns a "+granted, -revoked"
// summary using readable `module_code:action_code` labels.
function buildPermissionDiff(oldDetails, newDetails, moduleCodeById, actionCodeById) {
    const keyOf = (d) => `${d.module_id}_${d.action_id}`;
    const labelOf = (d) => `${moduleCodeById.get(d.module_id) || d.module_id}:${actionCodeById.get(d.action_id) || d.action_id}`;

    const oldMap = new Map(oldDetails.map((d) => [keyOf(d), d]));
    const newMap = new Map(newDetails.map((d) => [keyOf(d), d]));

    const added = [...newMap.keys()].filter((k) => !oldMap.has(k)).map((k) => `+${labelOf(newMap.get(k))}`);
    const removed = [...oldMap.keys()].filter((k) => !newMap.has(k)).map((k) => `-${labelOf(oldMap.get(k))}`);
    const parts = [...added, ...removed];

    return parts.length > 0 ? parts.join(', ') : 'No permission changes';
}

module.exports = { buildFieldDiff, buildPermissionDiff };
