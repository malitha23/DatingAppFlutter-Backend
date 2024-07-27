var mysql      = require('mysql');
var connection = mysql.createPool({
    connectionLimit : 10,
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'lovebordnewbackend'
});

module.exports = {connection};