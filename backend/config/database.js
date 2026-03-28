const mysql = require('mysql2/promise');
const env = require('./env');

async function createMysqlConnection() {
  return mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database
  });
}

module.exports = {
  createMysqlConnection
};
