const crypto = require('crypto');
const nodemailer = require('nodemailer');
const express = require("express");
const path = require("path");
const session = require("express-session");
const mongoose = require("mongoose");
const connectDB = require("./mongodb"); // Your MongoDB connection
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse incoming JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Define paths for static files and templates
const publicPath = path.join(__dirname, '../public'); // Adjust as necessary
const templatePath = path.join(__dirname, '../templates'); // Adjust as necessary

// Set up Handlebars as the view engine
app.set('view engine', 'hbs');
app.set('views', templatePath);
app.use(express.static(publicPath));

// Setup session
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
}));

// Connect to MongoDB
connectDB();

// Utility function to hash passwords
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Handle signup form submission
// Email transporter setup
const transporter = nodemailer.createTransport({
    service: 'Gmail',  // Use your preferred email service
    auth: {
        user: 'yeshwanthpoloju@gmail.com',
        pass: 'chdm uibc fasg ttei' 
    }
});

// Define the User schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, default: 'user' },
    isVerified: { type: Boolean, default: false },  // Email verification status
    verificationToken: { type: String }             // Token for verification
});


const User = mongoose.model('User', userSchema);

// Render signup page
app.get('/signup', (req, res) => {
    res.render('signup');
});

// Route to render the login page
app.get('/login', (req, res) => {
    res.render('login'); // This will render the login.hbs file located in the templates folder
});

app.get('/create-admin', (req, res) => {
    res.render('create-admin'); // This will render the create-admin.hbs file located in the templates folder
});


// Handle signup form submission
app.post('/signup', async (req, res) => {
    try {
        const existingUser = await User.findOne({ username: req.body.username });

        if (req.body.username === 'admin') {
            return res.status(400).json({ message: "Admin account already exists. Please login." });
        }

        if (existingUser) {
            return res.status(409).json({ message: "User already exists. Please login." });
        }

        const hashedPassword = hashPassword(req.body.password);
        const verificationToken = crypto.randomBytes(32).toString('hex');  // Create a random token

        const newUser = new User({
            username: req.body.username,
            password: hashedPassword,
            email: req.body.email,
            role: 'user',
            verificationToken,  // Store the token
            isVerified: false   // Not verified yet
        });

        await newUser.save();

        // Send verification email
        const verificationLink = `http://localhost:${port}/verify-email?token=${verificationToken}`;
        const mailOptions = {
            from: 'yeshwanthpoloju@gmail.com',
            to: req.body.email,
            subject: 'Verify your email',
            text: `Please verify your email by clicking the link: ${verificationLink}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("mail sending error", error);
                return res.status(500).json({ message: 'Error sending email.' });
            }
            res.status(201).json({ message: 'Signup successful! Please verify your email.' });
        });

    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: "Error during signup." });
    }
});


// POST Login Route
app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });

        if (!user) {
            return res.status(404).json({ message: "User not found. Please sign up." });
        }

        if (!user.isVerified) {
            return res.status(401).json({ message: "Please verify your email before logging in." });
        }

        const hashedInputPassword = hashPassword(req.body.password);
        if (hashedInputPassword === user.password) {
            req.session.user = { username: req.body.username, role: user.role };
            if (user.role === 'admin') {
                res.redirect('/admin-dashboard');
            } else {
                res.redirect('/home');
            }
        } else {
            res.status(401).json({ message: "Incorrect password." });
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Error during login." });
    }
});

// Email verification route
app.get('/verify-email', async (req, res) => {
    try {
        const token = req.query.token;
        const user = await User.findOne({ verificationToken: token });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token.' });
        }

        user.isVerified = true;
        user.verificationToken = null;  // Clear the token after verification
        await user.save();

        res.status(200).json({ message: 'Email verified successfully! You can now login.' });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ message: 'Error verifying email.' });
    }
});


// User home route
app.get('/home', (req, res) => {
    if (req.session.user) {
        res.render('home', { naming: req.session.user.username });
    } else {
        res.status(401).json({ message: "Unauthorized access. Please login." });
    }
});

// Admin dashboard route
app.get('/admin-dashboard', async (req, res) => {
    try {
        if (req.session.user && req.session.user.role === 'admin') {
            const users = await User.find({}, 'username role');
            res.render('admin-dashboard', { 
                naming: req.session.user.username, 
                users: users 
            });
        } else {
            res.status(403).json({ message: "Access denied. Admins only." });
        }
    } catch (error) {
        console.error("Error fetching users for admin dashboard:", error);
        res.status(500).json({ message: "Error loading dashboard." });
    }
});

// Handle admin creation form submission
app.post('/create-admin', async (req, res) => {
    try {
        const existingUser = await User.findOne({ username: req.body.username }); // Use the User model

        // Check if the user already exists
        if (existingUser) {
            return res.status(409).json({ message: "User already exists. Please login." });
        }

        // Hash the password
        const hashedPassword = hashPassword(req.body.password); // Hash the password
        const data = {
            username: req.body.username,
            password: hashedPassword,
            role: 'admin' // Set role to admin
        };

        // Create a new admin user and save to MongoDB
        const newUser = new User(data); // Use the User model
        await newUser.save();

        console.log("Admin created:", newUser); // Log the new user object
        res.status(201).json({ message: "Admin Signup successful!" });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: "Error during signup." });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
