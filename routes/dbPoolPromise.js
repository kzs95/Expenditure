const mysql = require('mysql2/promise');
// const mysql = require('mysql2');


const pool = mysql.createPool({
    connectionLimit: 100,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_USING
});

// const getConnection = function (callback) {
//     pool.getConnection((error, connect) => {
//         if (error) return callback(error);
//         else callback(null, connect);
//     });
// };

// const promisePool = pool.promise();

// module.exports = getConnection;
module.exports =  pool;
