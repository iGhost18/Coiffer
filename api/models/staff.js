const mongoose = require("mongoose");

const DayScheduleSchema = new mongoose.Schema(
    {
        startTime: {
            type: String,
            default: "09:00",
        },

        endTime: {
            type: String,
            default: "18:00",
        },

        slotDuration: {
            type: Number,
            default: 45,
        },

        maxBookings: {
            type: Number,
            default: 12,
        },
    },
{
    _id: false,
});

const StaffSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        minlength:3,
        maxlength:20,
        unique:true,
        trim:true
    },

    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    displayName: { type: String, default: "" },
    phone: {
        type: String,
        unique: true,
        sparse: true,
    },

    email:{
        type:String,
        required:true,
        maxlength:50,
        unique:true,
        trim:true,
        lowercase:true
    },

    password:{
        type:String,
        required:true,
        minlength:8,
    },

    profilePicture:{
        type:String,
        default:""
    },

    coverPicture: {
        type: [String],
        default: ["", "", ""],
    },

    isAdmin:{
        type:Boolean,
        default:false
    },
    desc:{
        type:String,
        maxlength:1000,
        default:"",
        trim:true
    },
    roles: [{ type: String }],

    workType: {
      type: String,
      enum: ["mobile", "stationed", "both"],
      default: "stationed",
    },
    experience:{
        type:Number,
        default:0
    },
    location: {
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "Nigeria" },
      coordinates: {
            lat: {
                type: Number,
                default: null,
            },

            lng: {
                type: Number,
                default: null,
            },
        },

    },
    gender:{
        type:String,
        enum:["male", "female", "other"]
    },
    clients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default:[]
    }],
    followers: [{ type: String }],
    followings: [{ type: String }],
    cuts: [{ type: String }],

    savedPosts: [{ type: String }],

    collection: [{ type: String }],
    featured: [{ type: String }],
    rating: {
        type: Number,
        default: 0
    },
    ratingCount: {
        type: Number,
        default: 0
    },
    specialties: [{ type: String }],

    workDays: [{ type: String }],

    schedule: {
        Monday: { type: DayScheduleSchema, default: () => ({}) },
        Tuesday: { type: DayScheduleSchema, default: () => ({}) },
        Wednesday: { type: DayScheduleSchema, default: () => ({}) },
        Thursday: { type: DayScheduleSchema, default: () => ({}) },
        Friday: { type: DayScheduleSchema, default: () => ({}) },
        Saturday: { type: DayScheduleSchema, default: () => ({}) },
        Sunday: { type: DayScheduleSchema, default: () => ({}) },
    },
    
    slotInterval: { type: Number, default: 30 }, 
    
    services:[
        {
           name:{
            type:String,
            required:true
           },
           price:{
            type:Number,
            required:true
           },
           img:{
            type:String,
            default:""
           }
        }
    ],
    
    openingHours:{
        Monday:String,
        Tuesday:String,
        Wednesday:String,
        Thursday:String,
        Friday:String,
        Saturday:String,
        Sunday:String
    },

    flutterwave: {
        subaccountId: {
            type: String,
            default: null,
        },

        subaccountStatus: {
            type: String,
            enum: ["not_connected", "pending", "active", "disabled"],
            default: "not_connected",
        },
    },

    flutterwave: {
        subaccountId: String,          // keep whatever you already have
        subaccountStatus: String,
        bankAccount: {
            account_bank: { type: String, default: null },   // bank code, e.g. "058"
            account_number: { type: String, default: null },
            account_name: { type: String, default: null },
        },
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

}, {timestamps:true})

module.exports = mongoose.model("Staff", StaffSchema);