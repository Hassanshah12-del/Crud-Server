const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const colors = require('colors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const UserModel = require("./models/Users");
const RegisterModel = require("./models/Registers");
const multer = require("multer");
const fs = require('fs');
const path = require("path");

const app = express();
dotenv.config()


app.use('/uploads', express.static('uploads'));


// CORS configuration
app.use(cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.json());
app.use(bodyParser.urlencoded({extended:false}))
app.use(morgan('dev'))

app.use(cookieParser());

// Multer setup for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Directory to save images
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Save files with unique names
    }
});

const upload = multer({ storage: storage });

// Connect to MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/employee");

// Middleware to verify user
const verifyUser = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.json("Token is missing");
    } else {
        jwt.verify(token, "jwt-secret-key", (err, decoded) => {
            if (err) {
                return res.json("Error with token");
            } else {
                if (decoded.role === "admin") {
                    next();
                } else {
                    return res.json("Not admin");
                }
            }
        });
    }
};

app.get('/dashboard', verifyUser, (req, res) => {
    res.json("Success");
});

// Register route
app.post("/register", (req, res) => {
    const { name, email, password } = req.body;
    bcrypt.hash(password, 10)
        .then(hash => {
            RegisterModel.create({ name, email, password: hash })
                .then(user => res.json("Success"))
                .catch(err => res.json(err));
        })
        .catch(err => res.json(err));
});

// Login route
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    RegisterModel.findOne({ email: email })
        .then(user => {
            if (user) {
                bcrypt.compare(password, user.password, (err, response) => {
                    if (response) {
                        const token = jwt.sign({ email: user.email, role: user.role }, "jwt-secret-key", { expiresIn: '1d' });
                        res.cookie('token', token);
                        return res.json({ Status: "Success", role: user.role });
                    } else {
                        return res.json("Password Incorrect");
                    }
                });
            } else {
                return res.json("No record existed");
            }
        });
});

// Get all users
app.get("/", (req, res) => {                    
    UserModel.find({})
        .then(users => res.json(users))
        .catch(err => res.json(err));
});

// Get user by ID
app.get("/getUser/:id", (req, res) => {
    const id = req.params.id;
    UserModel.findById({ _id: id })
        .then(user => res.json(user))
        .catch(err => res.json(err));
});

// Update user by ID
app.put("/updateUser/:id", upload.single('image'), async (req, res) => {
    const id = req.params.id;
    const { name, email, age } = req.body;
    const newImage = req.file ? `uploads/${req.file.filename}` : null;

    try {
        // Find the user to get the old image path
        const user = await UserModel.findById(id);

        if (user) {
            // If a new image is uploaded, delete the old one
            if (newImage && user.image) {
                const oldImagePath = path.join(__dirname, user.image);
                fs.unlink(oldImagePath, (err) => {
                    if (err) {
                        console.error("Error deleting old image:", err);
                    } else {
                        console.log("Old image deleted successfully.");
                    }
                });
            }

            // Update the user record with the new image and other fields
            const updatedUser = await UserModel.findByIdAndUpdate(
                id,
                { name, email, age, image: newImage || user.image }, // Keep the old image if no new one is uploaded
                { new: true }
            );
            res.json(updatedUser);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Delete user by ID
app.delete("/deleteUser/:id", async (req, res) => {
    const id = req.params.id;

    try {
        // Find the user to get the image path
        const user = await UserModel.findById(id);

        if (user && user.image) {
            // Construct the full path to the image file
            const imagePath = path.join(__dirname, user.image);

            // Delete the user's image file
            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.error("Error deleting image:", err);
                } else {
                    console.log("Image deleted successfully.");
                }
            });

            // Delete the user record
            await UserModel.findByIdAndDelete(id);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "User not found or no image to delete" });
        }
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});


app.post("/createUser", upload.single('image'), (req, res) => {
    const { name, email, age } = req.body;
    const image = req.file ? `uploads/${req.file.filename}` : null; // Save the full relative path

    UserModel.create({ name, email, age, image })
        .then(user => res.json(user))
        .catch(err => res.status(500).json({ error: "Server error" }));
});

const PORT = process.env.PORT || 3002

// Start server
app.listen(PORT, () => {
    console.log(`Server Running in ${process.env.DEV_MODE} on ${PORT}`.bgCyan.white);
});
