const crypto = require('crypto');
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

// Define the User schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // Ensure the username is unique
    password: { type: String, required: true },
    role: { type: String, default: 'user' } // Default role is user
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
        const existingUser = await User.findOne({ username: req.body.username }); // Use the User model

        // Check if the username is 'admin'
        if (req.body.username === 'admin') {
            return res.status(400).json({ message: "Admin account already exists. Please login." });
        }

        // Check if the user already exists
        if (existingUser) {
            return res.status(409).json({ message: "User already exists. Please login." });
        }

        // Hash the password
        const hashedPassword = hashPassword(req.body.password); // Hash the password
        const data = {
            username: req.body.username,
            password: hashedPassword,
            role: 'user' // Set role to user
        };

        // Create a new user and save to MongoDB
        const newUser = new User(data); // Use the User model
        await newUser.save();

        console.log("User created:", newUser); // Log the new user object
        res.status(201).json({ message: "Signup successful!" });
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

        const hashedInputPassword = hashPassword(req.body.password);
        if (hashedInputPassword === user.password) {
            // Set the session with the user details
            req.session.user = { username: req.body.username, role: user.role };
            if (user.role === 'admin') {
                res.redirect('/admin-dashboard');
            } else {
                res.redirect('/home');
            }
            console.log("User authenticated:", req.session.user);
        } else {
            res.status(401).json({ message: "Incorrect password." });
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Error during login." });
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
