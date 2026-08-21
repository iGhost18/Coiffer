const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({

    email:{
        type:String,
        required:true
    },

    token:{
        type:String,
        required:true,
        unique:true
    },

    role:{
        type:String,
        default:"staff"
    },

    used:{
        type:Boolean,
        default:false
    },

    expiresAt:{
        type:Date,
        required:true
    }

},{timestamps:true});

module.exports = mongoose.model("Invite", InviteSchema);