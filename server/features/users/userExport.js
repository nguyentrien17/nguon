const ExcelJS = require('exceljs');
const { USER_STATUS } = require('#shared');

async function buildUsersWorkbook(rows) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');

    sheet.columns = [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Username', key: 'username', width: 20 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Full name', key: 'full_name', width: 24 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Created at', key: 'created_at', width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };

    rows.forEach((row) => {
        sheet.addRow({
            id: row.id,
            username: row.username,
            email: row.email,
            full_name: row.full_name,
            status: row.status === USER_STATUS.ACTIVE ? 'Active' : 'Locked',
            created_at: new Date(row.created_at).toISOString(),
        });
    });

    return workbook.xlsx.writeBuffer();
}

module.exports = { buildUsersWorkbook };
