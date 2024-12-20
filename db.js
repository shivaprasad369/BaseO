import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host : 'srv673.hstgr.io',
    user: 'u597837427_baseo',         // Your MySQL username
    password: 'Shivaprasad@#2000', // Your MySQL password
    database: 'u597837427_baseo' ,
   
});

// Export the pool
export default pool;
