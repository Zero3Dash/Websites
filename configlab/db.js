const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,                          // maximum number of clients in the pool
    idleTimeoutMillis: 30000,          // close idle clients after 30 seconds
    connectionTimeoutMillis: 2000,      // return an error if connection not established in 2 seconds
});

// Test the database connection on startup
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.stack);
    } else {
        console.log('✅ Successfully connected to PostgreSQL');
        release();
    }
});

// Handle unexpected pool errors
pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};