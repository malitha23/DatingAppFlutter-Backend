var mysql      = require('mysql');
var connection = mysql.createPool({
    connectionLimit : 10,
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'lovebordnewbackend',
  charset: 'utf8mb4'
});

module.exports = {connection};