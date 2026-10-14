const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
    {
        members:{
            type: Array,
        },
        lastMessageAt: { type: Date, default: Date.now, index: true },
    },
    {timestamps:true}
);

module.exports = mongoose.model("Conversation", ConversationSchema);