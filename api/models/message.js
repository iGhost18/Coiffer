const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
    {
        conversationId:{
            type: String,
        },
        sender:{
            type: String,
        },
        text:{
            type:String,
        },
        type: {
        type: String,
        enum: ["text", "booking"],
        default: "text",
        },
        bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        },
        status: {
        type: String,
        },
        read: {
            type: Boolean,
            default: false,
        },
    },
    {timestamps:true}
);

module.exports = mongoose.model("Message", MessageSchema);