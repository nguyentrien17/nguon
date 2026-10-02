const db = require('#core/database/db');
const baseRepository = require('#core/database/baseRepository');

const base = baseRepository('actions');

const findAll = () => base.findAll((q) => q.orderBy('module_id', 'asc').orderBy('id', 'asc'));

async function create({ module_id, action_code, action_name, description, rate_limit_per_minute }) {
    return base.create({
        module_id,
        action_code,
        action_name,
        description: description || null,
        rate_limit_per_minute: rate_limit_per_minute || null,
    });
}

async function findByModuleAndCode(moduleCode, actionCode) {
    const row = await db('actions as a')
        .join('modules as m', 'm.id', 'a.module_id')
        .where('m.module_code', moduleCode)
        .andWhere('a.action_code', actionCode)
        .select('a.*')
        .first();
    return row || null;
}

module.exports = { ...base, findAll, create, findByModuleAndCode };
