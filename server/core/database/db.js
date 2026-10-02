const knex = require('knex');
const env = require('../config/env');

const db = knex({
    client: 'mysql2',
    connection: {
        host: env.db.host,
        user: env.db.user,
        password: env.db.password,
        database: env.db.name,
        dateStrings: false,
    },
    pool: { min: 2, max: 10 },
});

module.exports = db;
