const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    age: Number,
    image: String // New field to store the image URL or file path
});

const UserModel = mongoose.model("users", UserSchema);
module.exports = UserModel;