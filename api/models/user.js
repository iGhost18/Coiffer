const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({

    username:{
        type:String,
        required:true,
        minlength:3,
        maxlength:20,
        unique:true,
        trim:true
    },

    email:{
        type:String,
        required:true,
        maxlength:50,
        unique:true,
        lowercase:true,
        trim:true
    },

    password:{
        type:String,
        required:true,
        minlength:8,
    },

    firstName:{
        type:String,
        default:""
    },

    lastName:{
        type:String,
        default:""
    },

    phone: {
        type: String,
        unique: true,
        sparse: true,
    },
    
    bio: {
        type: String,
        default: ""
    },
    
    birthDay: {
        type: String,
        default: ""
    },

    birthMonth:{
        type:String,
        default:""
    },

    state:{
        type:String,
        default:""
    },

    city:{
        type:String,
        default:""
    },
    country:{
        type:String,
        default:""
    },

    gender:{
        type:String,
        default:""
    },
    
    groomers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
        default:[]
    }],

    hairType:{
        type:String,
        default:""
    },

    hairColor:{
        type:String,
        default:""
    },

    hairStyle:{
        type:String,
        default:""
    },

    // Free-text notes the user keeps for themselves — only ever read/written
    // by their own profile page.
    personalNote:{
        type:String,
        default:""
    },

    collection:{
        type:[String],
        default:[]
    },

    featured:{
        type:[String],
        default:[]
    },

    profilePicture:{
        type:String,
        default:""
    },

    coverPicture:{
        type:String,
        default:""
    },

    followings:{
        type:Array,
        default:[]
    },

    cuts: {
        type: [String],
        default: []
    },

    likes: {
        type: [String],
        default: []
    },

    savedPosts:{
        type:[String],
        default:[]
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    
    lastScheduleView: {
        type: Date,
        default: null
    },
    lastFeedView: {
        type: Date,
        default: null
    },
},{timestamps:true});

module.exports = mongoose.model("User", UserSchema);