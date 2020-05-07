import mysql from 'mysql';

const connection = mysql.createConnection({
    host     : '198.58.109.236',
    port     : 3306,
    user     : 'dentalk',
    password : '!CCOKRQ1Ca1x',
    database : 'dentalk'
});

function execQuery(sqlQry){
    return new Promise((resolve, reject) => {
        connection.query(sqlQry, function(error, results){
            if(error) {
                if (error.code == 'ER_DUP_ENTRY') {
                    reject('Registro duplicado no banco de dados.');
                } else {
                    reject(JSON.parse(JSON.stringify(error)));
                }
            }
            else {
                resolve(JSON.parse(JSON.stringify(results)));
            }
        });
    });
}

export default {
    execQuery
};