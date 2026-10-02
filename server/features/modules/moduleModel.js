const db = require('#core/database/db');
const baseRepository = require('#core/database/baseRepository');

const base = baseRepository('modules');

const findAll = () => base.findAll((q) => q.orderBy('module_index', 'asc').orderBy('id', 'asc'));

// Inserts a module at `module_index` within its sibling group (same module_parent_id),
// shifting every sibling at or after that position down by one so no two siblings share an index.
async function create({ module_code, module_name, module_href, module_element_id, module_parent_id, module_type, module_icon, module_index, description }) {
    const parentId = module_parent_id || null;
    const index = module_index ?? 0;

    return db.transaction(async (trx) => {
        await trx('modules')
            .whereRaw('module_parent_id <=> ?', [parentId])
            .andWhere('module_index', '>=', index)
            .increment('module_index', 1);

        const [id] = await trx('modules').insert({
            module_code,
            module_name,
            module_href: module_href || null,
            module_element_id: module_element_id || null,
            module_parent_id: parentId,
            module_type: module_type || 1,
            module_icon: module_icon || null,
            module_index: index,
            description: description || null,
        });
        return id;
    });
}

async function update(id, fields) {
    // Không đổi module_index thì không cần dịch chuyển anh em cùng cấp, dùng thẳng update chuẩn.
    if (fields.module_index === undefined) {
        return base.update(id, fields);
    }

    return db.transaction(async (trx) => {
        const current = await trx('modules').where({ id }).forUpdate().first();
        if (!current) return 0;

        const oldIndex = current.module_index;
        const newIndex = fields.module_index;
        const parentId = current.module_parent_id;

        if (newIndex > oldIndex) {
            // Moving down: everything strictly after the old spot up to the new spot shifts up by one.
            await trx('modules')
                .whereRaw('module_parent_id <=> ?', [parentId])
                .andWhere('module_index', '>', oldIndex)
                .andWhere('module_index', '<=', newIndex)
                .andWhereNot('id', id)
                .decrement('module_index', 1);
        } else if (newIndex < oldIndex) {
            // Moving up: everything from the new spot up to just before the old spot shifts down by one.
            await trx('modules')
                .whereRaw('module_parent_id <=> ?', [parentId])
                .andWhere('module_index', '>=', newIndex)
                .andWhere('module_index', '<', oldIndex)
                .andWhereNot('id', id)
                .increment('module_index', 1);
        }

        return trx('modules').where({ id }).update(fields);
    });
}

// BFS toàn bộ id module con (đệ quy qua module_parent_id), gồm cả id gốc — dùng cho archive/restore.
async function findSubtreeIds(id) {
    const all = await findAll();
    const ids = [Number(id)];
    let frontier = [Number(id)];
    while (frontier.length > 0) {
        const children = all.filter((m) => frontier.includes(m.module_parent_id)).map((m) => m.id);
        ids.push(...children);
        frontier = children;
    }
    return ids;
}

// Set status cho toàn bộ module trong subtree (gồm gốc) và mọi action thuộc các module đó,
// trong 1 transaction — dùng cho archive (status=2) và restore (status=1).
async function setSubtreeStatus(id, status) {
    const ids = await findSubtreeIds(id);
    await db.transaction(async (trx) => {
        await trx('modules').whereIn('id', ids).update({ status });
        await trx('actions').whereIn('module_id', ids).update({ status });
    });
    return ids;
}

module.exports = { ...base, findAll, create, update, findSubtreeIds, setSubtreeStatus };
