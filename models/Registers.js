const mongoose = require('mongoose')

const RegisterSchema = new mongoose.Schema({
    name: String,
    email:String,
    password: String,

    role:{
        type: String,
        default: "visitor"
    }
})

const RegisterModel = mongoose.model("userss", RegisterSchema);
module.exports = RegisterModel
