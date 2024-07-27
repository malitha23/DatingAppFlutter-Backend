var mysql      = require('mysql');
var connection = mysql.createPool({
    connectionLimit : 10,
  host     : 'localhostt',
  user     : 'root',
  password : '',
  database : 'lovebordnewbackend'
});

module.exports = {connection};