// Tách khỏi core/utils/auditDiff.js: hàm này biết tới `module_id`/`action_id` — tức biết tới
// cấu trúc bảng permission_details của RBAC — nên nó là nghiệp vụ, không phải hạ tầng.
// Phép thử ở docs/architecture.md: "copy sang dự án quản lý kho hàng còn dùng được không?".

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

module.exports = { buildPermissionDiff };
