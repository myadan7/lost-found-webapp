const mysql = require('mysql2');
const bcrypt = require('bcrypt');

// Connecting the database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password:'gotham',
    database:'lost_found_app' 
});

// Admin creation
db.connect((err) => {
    if (err) {
        console.error('Connection failed', err);
        return;
    }
    console.log('Successfully connected to database!');

    // Login details
    const username = 'admin';
    const defaultPassword = 'admin321';

    bcrypt.hash(defaultPassword, 10, (err,hashedPassword) => {
        if (err){
            console.error('Error hashing password:', err);
            db.end();
            return;
    }


    // Admin database initialisation
    const query = 'INSERT INTO admins (username, password) VALUES (?,?)';
    db.query(query, [username, hashedPassword], (err,result) => {
        if (err) {
            console.error('Error creating admin:',err);
            db.end();
            return;
        }

    console.log('Admin created successfully!');
    console.log('Username: admin');
    console.log('Password: admin321');
    db.end();
    });
});
});
