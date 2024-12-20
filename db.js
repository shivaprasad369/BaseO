import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    port : 'hocalhost',
    user: 'root',         // Your MySQL username
    password: '', // Your MySQL password
    database: 'baso'   // The database you created
});

// Export the pool
export default pool;
