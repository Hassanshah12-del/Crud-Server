const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const UserModel = require("./models/Users")
const RegisterModel = require("./models/Registers")


const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());


mongoose.connect("mongodb://127.0.0.1:27017/Register")


app.get("/",(req,res) => {                    
    UserModel.find({})
    .then(users => res.json(users))
    .catch(err => res.json(err))
})

app.get("/getUser/:id",(req,res) => {
    const id = req.params.id;
    UserModel.findById({_id:id})
    .then(users => res.json(users))
    .catch(err => res.json(err))
})

app.put("/updateUser/:id",(req,res) => {
    const id = req.params.id;
    UserModel.findByIdAndUpdate({_id: id},{name: req.body.name ,email:req.body.email,age:req.body.age})
    .then(users => res.json(users))
    .catch(err => res.json(err))
})

app.delete("/deleteUser/:id",(req,res) => {
    const id = req.params.id;
    UserModel.findByIdAndDelete({_id: id})
    .then(res => res.json(res))
    .catch(err => res.json(err))
})

app.post("/createUser",(req,res) => {
    UserModel.create(req.body)
    .then(users => res.json(users))
    .catch(err => res.json(err))
}) 

app.post("/register",(req,res) => {
    const {name,email,password} = req.body;
    RegisterModel.findOne({email:email})
    .then(user => {
    if(user){
        res.json("Already have an account")
    }
    else{
        RegisterModel.create({name:name,email:email,password:password})
        .then(user => res.json("Account Created"))
        .catch(err => res.json(err)) 
    }
    })
    .catch(err => res.json(err))
}) 

app.listen(3001, () => {
    console.log("Server is Running")
})