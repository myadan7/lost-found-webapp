if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// Import is created using express
const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
// Session based token
const session = require ('express-session');
// Cron job initialisation
const cron = require('node-cron');
// Email notifications
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Ejs template
app.set('view engine','ejs');
//Middleware that parses form data
app.use(express.urlencoded({extended:true}));
//Session intialisation
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 3600000}
})); 
const port = 3000;
const mysql = require('mysql2');
const e = require('express');

// Middleware ensuring the user is an admin
function isAdmin(req, res, next) {
    // Success path
    if (req.session.isAdmin) {
        next();
    }
        else {
            // If the user is not an admin, it redirects to the login page
            res.redirect('/admin/login'); 
        }

}

// Homepage routing
app.get('/',(req,res) => {
    const { search, category, item_type, status } = req.query;

    let query = 'SELECT * FROM items WHERE 1=1';
    const values = [];

    if (search && search.trim() !== '') {
        query += ' AND (item_name LIKE ? OR location LIKE ?)';
        const searchInput = `%${search}%`;
        values.push(searchInput, searchInput);
    }

    if (category && category !== '') {
    query += ' AND category = ?';
    values.push(category);
    }
    
    if (item_type && item_type !== '') {
    query += ' AND item_type = ?';
    values.push(item_type);
    }

    if (status && status !== '') {
    query += ' AND status = ?';
    values.push(status);       
    }

    query += ' ORDER BY created_at DESC';
    
    // Retrieves items from the database
    db.query(query, values,(err, results) => {
        if (err) {
            console.error('Error fetching items:', err);
            return res.status(500).send('Error loading items');
        }
        res.render('index', {
            items: results,
            currentPage:'home',
            searchTerm: search || '',
            selectedCategory: category || '',
            selectedType: item_type || '',
            selectedStatus: status || '',
        });    
            
    });
});


// Report form
app.get('/report',(req, res) => {
    res.render('report', {error: null, formData: null, currentPage:'report'});
});

// Form submission
app.post('/report',(req,res) => {
    const{item_name, description, category, location, contact_email, item_type, terms_agreed} = req.body;

    if (!terms_agreed) {
        return res.status(400).send('You must agree to the terms and conditions before submitting.')
    }

    const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailFormat.test(contact_email)) {
        return res.render('report', {error: 'That email is invalid, please try again.',
            formData: req.body, 
            currentPage:'report'
        });
    }

    const query = 'INSERT INTO items (item_name, description, category, location, contact_email, item_type, status, reference_number) values (?, ?, ?, ?, ?, ?, ?, ?)';
    const refNumber = `F${Math.floor(1000 + Math.random()* 9000)}`;
    const values = [item_name, description, category, location, contact_email, item_type, 'pending', refNumber];

    db.query(query, values, (err,result) => {
    if (err) {
        console.error('Error saving item:', err);
        return res.status(500).send('Error submitting report');
    }
    console.log('Item saved successfully! ID:', result.insertId);
    
    // Confirmation email is sent to the user once they submit a report
    console.log('Sending email to:', contact_email);
    const confirmationEmail = {
        from:'personaltesting7861@gmail.com',
        to: contact_email,
        subject:'Lost & Found - Report Submitted',
        text:`Hello,\n\n` + 
        `Your report has been submitted successfully.\n\n` +
        `Item: ${item_name}\n` +
        `Reference Number: ${refNumber}\n\n` +
        (item_type === 'found'
            ? `Next steps:\n` +
            `Since you have found this item, please hand it into your nearest office / reception on campus as soon as possible.\n\n` +
            `Our team will will now work on returning the item to it's rightful owner.\n\n` +
            `Thank you for your contribution, it is greatly appreciated!\n\n` 
            : `Next steps:\n` +
            `We have logged your report and will keep you updated on this email address if anything matching your description is handed in.\n\n` +
            `You can also track your item status at any time using your reference number on the website.\n\n` +
            `We will do our upmost to ensure you receive your item back!\n\n`) +
            `Best wishes,\n` +
            `University of Huddersfield Lost & Found Team`
    };


     resend.emails.send({
            from: 'noreply@campuslostandfound.site',
            to: contact_email,
            subject: 'Lost & Found - Report Submitted',
            text: confirmationEmail.text
        }).then(() => {
            console.log('Confirmation email sent to:' + contact_email);
        }).catch((err) => {
            console.error('Error sending email:', err);
        });
    
    
    res.redirect(`/confirmation?ref=${refNumber}`);
    });
});    


// Confirmation page displays after the report is successfully submitted
app.get('/confirmation',(req,res)=> {
    const {ref} = req.query;
    res.render('confirmation',{refNumber:ref, currentPage: 'confirmation'});
})

// Item tracking page route
app.get('/track',(req,res)=> {
    res.render('track', {currentPage: 'track'});
});
    // Form submissiom
    app.post('/track',(req,res)=> {
        const {contact_email,reference_number} = req.body;
        const query = 'SELECT *FROM items WHERE contact_email = ? AND reference_number = ?';

        db.query(query,[contact_email,reference_number], (err, results)=> {
        if (err) {
            console.error('Error tracking item:',err);
            return res.status(500).send('Error retrieving item');
        }
        res.render('track', {
            result: results.length > 0 ? results[0] : null, 
            currentPage: 'track'
        });

    });
});

// Admin login page
app.get('/admin/login',(req, res) => {
    res.render('admin-login', {error: null, currentPage:'admin'});

});

// Admin Handler
app.post('/admin/login',(req, res) => {
    const {username,password} = req.body;
    const query = 'SELECT * FROM admins WHERE username = ?';
    db.query(query,[username], (err, results)=> {
        if (err) {
            console.error('Database error:',err);
            return res.status(500).send('Error logging in');
        }

        // Admin check
        if (results.length === 0) {
            return res.render('admin-login',{error: 'Invalid Username or Password', currentPage:'admin'});
        }
        const admin = results[0];

        // Ensures passwords match with hash (positive / negative if statements)
        bcrypt.compare(password, admin.password, (err, isMatch)=> {
            if (err) {
                console.error('Bcrypt error:',err);
                return res.status(500).send('Error logging in');
            }
            if (!isMatch){
                return res.render('admin-login', {error:'Invalid Username or Password'});
            }
            // Checks password matches and session is created
            req.session.isAdmin = true;
            req.session.adminId = admin.id;
            req.session.username = admin.username;

            console.log('Admin logged in:', admin.username);
            res.redirect('/admin/dashboard');
        });
    });
});    

// Admin Dashboard - route
app.get('/admin/dashboard',isAdmin ,(req,res) => {
    const { search, category, item_type, status } = req.query;

    let query = 'SELECT * FROM items WHERE 1=1';
    const values = [];

    if (search && search.trim() !== '') {
        query += ' AND (item_name LIKE ? OR location LIKE ?)';
        const searchInput = `%${search}%`;
        values.push(searchInput, searchInput);
    }

    if (category && category !== '') {
    query += ' AND category = ?';
    values.push(category);
    }
    
    if (item_type && item_type !== '') {
    query += ' AND item_type = ?';
    values.push(item_type);
    }

    if (status && status !== '') {
    query += ' AND status = ?';
    values.push(status);       
    }

    query += ' ORDER BY created_at DESC';
    
    // Retrieves items from the database
    db.query(query, values,(err, results) => {
        if (err) {
            console.error('Error fetching items:', err);
            return res.status(500).send('Error loading dashboard');
        }
        res.render('admin-dashboard', {
            currentPage:'dashboard',
            items: results,
            username:req.session.username,
            searchTerm: search || '',
            selectedCategory: category || '',
            selectedType: item_type || '',
            selectedStatus: status || '',
        });    
            
    });
});
// Route for admin updating an item when logged in as Admin
app.post('/admin/update-status', isAdmin, (req, res) => {
    const {item_id, status} = req.body;
    const query = 'UPDATE items SET status = ? WHERE id = ?';

        db.query(query, [status, item_id], (err, result)=>{
        if (err) {
            console.error('Error updating items:', err);
        return res.status(500).send('Error updating item');
        }

        console.log(`Item ${item_id} status changed to ${status}`);

        // Email is sent to the reported updating the user the item has been returned
        if (status === 'claimed' || status === 'returned') {
            const getEmail = 'SELECT contact_email, item_name, item_type, reference_number FROM items WHERE id = ?';
            db.query(getEmail, [item_id], (err, rows) => {
                if (err) {
                    console.error('Error fetching item details:',err);

                } else {
                    const reporterEmail = rows[0].contact_email;
                    const item_name = rows[0].item_name;
                    const item_type = rows[0].item_type;
                    const reference_number = rows[0].reference_number;

                    // This line ensures the lost reporter is only emailed when the item is claimed and returned
                    const shouldEmail = (status === 'claimed' && item_type === 'lost') || status === 'returned';

                    if (shouldEmail) {
                        let emailText;

                    if (status === 'claimed' && item_type === 'lost') {
                    emailText = `Hello,\n\n` +
                        `Great news! An item matching your description has been handed in.\n\n` +
                        `Item: ${item_name}\n\n` +
                        `Reference Number: ${reference_number}\n\n` +
                        `Please visit the Harold Wilson building to verify ownership.\n\n` +
                        `Remember to bring your reference number with you.\n\n` +
                        `Kind regards,\n` +
                        `University of Huddersfield Lost & Found Team`;
                    }   
                    else if (status === 'returned' && item_type === 'lost') {
                    emailText = `Hello,\n\n` +
                        `Your item has been successfully returned to you!\n\n` +
                        `Item: ${item_name}\n\n` +
                        `Thank you for your patience throughout this process, we really appreciate it.\n\n` +
                        `We hope our service helped!\n\n` +
                        `Kind regards,\n` +
                        `University of Huddersfield Lost & Found Team`;
                    }   
                    else if (status === 'returned' && item_type === 'found') {
                    emailText = `Hello,\n\n` +
                        `Great news! The item you found has been returned to its owner.\n\n` +
                        `Item: ${item_name}\n\n` +
                        `Thank you very much for your contribution, it is greatly appreciated.\n\n` +
                        `Kind regards,\n` +
                        `University of Huddersfield Lost & Found Team`;

                    }

                    resend.emails.send({
                        from: 'noreply@campuslostandfound.site',
                        to: reporterEmail,
                        subject: 'Lost & Found - Item Update',
                        text: emailText
                    }).then(() => {
                        console.log(`Email sent to ${reporterEmail} for status: ${status}`);
                    }).catch((err) => {
                        console.error('Error sending return email:', err);
                    });
                    }
                }
            });
        }
        res.redirect('/admin/dashboard');
    });
});    


// Admin can add notes 
app.post('/admin/save-notes',isAdmin,(req,res) => {
    const {item_id, admin_notes} = req.body;
    const query = 'UPDATE items SET admin_notes = ? WHERE id = ?';
    db.query(query, [admin_notes, item_id], (err, result) => {
        if (err) {
            
            console.error('Error saving note',err);
            return res.status(500).send('Error saving note');
        }
            console.log('Note successfully saved' + item_id);
            res.redirect('/admin/dashboard');
    });

});


// Route for the admin deleting an item
app.post('/admin/delete-item',isAdmin,(req,res)=> {
    const {item_id} = req.body;
    const query = 'DELETE FROM items WHERE id = ?';

        db.query(query, [item_id], (err, result)=>{
        if (err) {
            console.error('Error deleting item:', err);
        return res.status(500).send('Error deleting item');
        }

        console.log(`Item ${item_id} deleted`);
        res.redirect('/admin/dashboard');
        });
});

// Admin stats page
app.get('/admin/stats', isAdmin,(req,res) => {
    // Total items reported in the month
    const monthlyTotal = 'SELECT COUNT(*) AS total FROM items WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())';

    // Most common category 
    const categoryTotal ='SELECT category, COUNT(*) AS total FROM items GROUP BY category ORDER BY total DESC LIMIT 1';

    // Most common location
    const locationFind = 'SELECT location, COUNT(*) AS total FROM items GROUP BY location ORDER BY total DESC LIMIT 1';

    // Percentage of items returned
    const returnedTotal = 'SELECT ROUND(100 * SUM(CASE WHEN status = "returned" THEN 1 ELSE 0 END) / COUNT(*), 1) AS percentage FROM items';

    // Total items reported
     const totalQuery = 'SELECT COUNT(*) AS total FROM items';

        // Each query
            db.query(monthlyTotal, (err, monthlyResult) => {
                if (err) { console.error('Stats error:', err); return res.status(500).send('Error loading stats'); }

            db.query(categoryTotal, (err, categoryResult) => {
            if (err) { console.error('Stats error:', err); return res.status(500).send('Error loading stats'); }

            db.query(locationFind, (err, locationResult) => {
                if (err) { console.error('Stats error:', err); return res.status(500).send('Error loading stats'); }

                db.query(returnedTotal, (err, returnedResult) => {
                    if (err) { console.error('Stats error:', err); return res.status(500).send('Error loading stats'); }

                    db.query(totalQuery, (err, totalResult) => {
                        if (err) { console.error('Stats error:', err); return res.status(500).send('Error loading stats'); }

                        res.render('admin-stats', {
                            currentPage:'dashboard',
                            monthly: monthlyResult[0].total,
                            topCategory: categoryResult[0] ? categoryResult[0].category : 'N/A',
                            topLocation: locationResult[0] ? locationResult[0].location : 'N/A',
                            returnedPercentage: returnedResult[0].percentage || 0,
                            totalItems: totalResult[0].total
                        });
                    });
                });
            });
        });
    });
});


// Route for when the Admin clicks 'logout'
app.get('/admin/logout',(req,res) => {
    req.session.destroy((err)=> {
        if (err) {
            console.error('Error session:', err);

        }
        res.redirect('/');
    });   
});

// Cron Job runs every midnight to clear any old data
cron.schedule('0 0 * * *',() => {
    const query = 'DELETE FROM items WHERE status IN("returned", "claimed") AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)';
    db.query(query,(err, result)=> {
        if (err) {
            console.error('Cleanup error:,',err);
            return;
        }
        console.log(`Daily cleanup done - ${result.affectedRows} old items removed`);
    });

});


// Function that starts the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})

// Database connection
const db = mysql.createPool({
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || 'lost_found_app',
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
});
