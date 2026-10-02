const db = require('../../config/database');
const baseRepository = require('../../utils/baseRepository');

const base = baseRepository('audit_logs');

async function create({ userId = null, action, ip, status, detail = null }) {
    try {
        await base.create({ user_id: userId, action, ip_address: ip, status, detail });
    } catch (err) {
        console.error('Audit log failed:', err.message);
    }
}

function applyFilters(qb, { action, status }) {
    if (action) qb.andWhere('al.action', action);
    if (status) qb.andWhere('al.status', status);
}

async function list({ page, limit, action, status }) {
    const offset = (page - 1) * limit;

    const rows = await db('audit_logs as al')
        .leftJoin('users as u', 'u.id', 'al.user_id')
        .where((qb) => applyFilters(qb, { action, status }))
        .orderBy('al.created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select('al.id', 'al.user_id', 'u.username', 'al.action', 'al.ip_address', 'al.status', 'al.detail', 'al.created_at');
    const { total } = await db('audit_logs as al')
        .where((qb) => applyFilters(qb, { action, status }))
        .count({ total: '*' })
        .first();

    return { rows, total: Number(total) };
}

async function listActions() {
    const rows = await base.findAll((q) => q.distinct('action').orderBy('action', 'asc'));
    return rows.map((r) => r.action);
}

module.exports = { create, list, listActions };
