const fs = require('fs');
const mariadb = require('mariadb');

const file = fs.readFileSync(__dirname + '/database-config.json');
const config = JSON.parse(file.toString('utf8'));
const pool = mariadb.createPool(config);

module.exports = () => pool.getConnection();
