const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
{
    senderId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        refPath:"senderModel"
    },

    senderModel:{
        type:String,
        required:true,
        enum:["User","Staff"]
    },

    receiverId:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        refPath:"receiverModel"
    },

    receiverModel:{
        type:String,
        required:true,
        enum:["User","Staff"]
    },

    type:{
        type:String,
        enum:[
            "message",
            "follow",
            "like",
            "comment",
            "post",
            "appointment",
            "booking",
            "payment",
            "service",
            "groomer",
            "bookingConfirmed"
        ],
        default:"message",
        required:true
    },

    text:{
        type:String,
        required:true
    },

    image: {
        type: String,
        default: ""
    },

    postId:{
        type:mongoose.Schema.Types.ObjectId,
        default:null,
        ref:"Post"
    },

    conversationId:{
        type:mongoose.Schema.Types.ObjectId,
        default:null,
        ref:"Conversation"
    },

    link:{
        type:String,
        default:""
    },

    isRead:{
        type:Boolean,
        default:false
    },

    actionId: {
        type: String,
        default: ""
    },
    
    deleted: {
        type: Boolean,
        default: false
    },

},
{
    timestamps:true
});

module.exports = mongoose.models.Notification || mongoose.model(
    "Notification",
    NotificationSchema
);