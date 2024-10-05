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

        // Store the password directly without encryption
        const data = {
            username: req.body.username,
            password: req.body.password,  // No encryption
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
        // Find the user by username
        const user = await User.findOne({ username: req.body.username }); // Use the User model

        // Check if user exists
        if (!user) {
            return res.status(404).json({ message: "User not found. Please sign up." });
        }

        // Directly compare the plain text password from the request with the one in the database
        if (req.body.password === user.password) {
            // Set the session with the user details
            req.session.user = { username: req.body.username, role: user.role };
            res.redirect('/home')
            console.log("User authenticated:", req.session.user); // Log authenticated user session
        } else {
            // If password doesn't match
            res.status(401).json({ message: "Incorrect password." });
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Error during login." });
    }
});

app.get('/home', (req, res) => {
    res.render('home', { naming: req.session.user.username });
});



// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
