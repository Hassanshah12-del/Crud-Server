// Required modules
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
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const UserModel = require('./models/Users');
const RegisterModel = require('./models/Registers');
const serverless = require('serverless-http');

// Initialize the app and load environment variables
dotenv.config({path:"./config/.env"})
const app = express();

// Static files route
app.use('/uploads', express.static('uploads'));

// CORS configuration
const corsOptions = {
    origin: 'https://crud-client-five.vercel.app', // Your client-side URL
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true, // Allows cookies and other credentials to be sent
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200,
};

app.use(cors(corsOptions)); // Apply CORS middleware

const allowCors = fn => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  // another common pattern
  // res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  return await fn(req, res)
}

const handler = (req, res) => {
  const d = new Date()
  res.end(d.toString())
}

module.exports = allowCors(handler)


// Middlewares
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.json());

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

// MongoDB connection
mongoose.connect("mongodb+srv://hassan:hassan123@cluster0.ky71w.mongodb.net/crud?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// Chatbot API route
app.post('/api/chatbot', async (req, res) => {
    const { message } = req.body;

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4",
            messages: [{ "role": "user", "content": message }]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error with chatbot API:', error.message);
        res.status(500).send('Server Error');
    }
});

// Middleware to verify user
const verifyUser = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(403).json("Token is missing");
    } else {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json("Error with token");
            } else {
                if (decoded.role === "admin") {
                    next();
                } else {
                    return res.status(403).json("Not admin");
                }
            }
        });
    }
};

// Routes
app.get('/dashboard', verifyUser, (req, res) => {
    res.json("Success");
});

app.post("/register", (req, res) => {
    const { name, email, password } = req.body;
    bcrypt.hash(password, 10)
        .then(hash => {
            RegisterModel.create({ name, email, password: hash })
                .then(user => res.json("Success"))
                .catch(err => res.status(500).json(err));
        })
        .catch(err => res.status(500).json(err));
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;
    RegisterModel.findOne({ email: email })
        .then(user => {
            if (user) {
                bcrypt.compare(password, user.password, (err, response) => {
                    if (response) {
                        const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
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

app.get("/", (req, res) => {
    UserModel.find({})
        .then(users => res.json(users))
        .catch(err => res.status(500).json(err));
});

app.get("/getUser/:id", (req, res) => {
    const id = req.params.id;
    UserModel.findById({ _id: id })
        .then(user => res.json(user))
        .catch(err => res.status(500).json(err));
});

app.put("/updateUser/:id", upload.single('image'), async (req, res) => {
    const id = req.params.id;
    const { name, email, age } = req.body;
    const newImage = req.file ? `uploads/${req.file.filename}` : null;

    try {
        const user = await UserModel.findById(id);

        if (user) {
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

            const updatedUser = await UserModel.findByIdAndUpdate(
                id,
                { name, email, age, image: newImage || user.image },
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

app.delete("/deleteUser/:id", async (req, res) => {
    const id = req.params.id;

    try {
        const user = await UserModel.findById(id);

        if (user && user.image) {
            const imagePath = path.join(__dirname, user.image);

            fs.unlink(imagePath, (err) => {
                if (err) {
                    console.error("Error deleting image:", err);
                } else {
                    console.log("Image deleted successfully.");
                }
            });

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
    const image = req.file ? `uploads/${req.file.filename}` : null;

    UserModel.create({ name, email, age, image })
        .then(user => res.json(user))
        .catch(err => res.status(500).json({ error: "Server error" }));
});

module.exports = app;
