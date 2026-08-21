const mongoose = require("mongoose");

const ReplySchema = new mongoose.Schema(
    {
        userId: String,
        text: String,
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }
    // no {_id:false} here on purpose — each reply gets its own _id
    // automatically, same as comments do, in case you want to
    // target/delete a specific reply later.
);

const CommentSchema = new mongoose.Schema({
    userId: String,
    text: String,
    createdAt: {
        type: Date,
        default: Date.now,
    },
    likes: {
        type: [String],
        default: [],
    },
    replies: {
        type: [ReplySchema],
        default: [],
    },
});

const PostSchema = new mongoose.Schema({

    staffId:{
        type:String,
        required:true
    },

    desc:{
        type:String,
        max:500
    },

    img:{
        type:Array,
        default:[]
    },

    tags: [
    {
        id: { type: mongoose.Schema.Types.ObjectId },
        username: String,
        memberType: { type: String, enum: ["User", "Staff"] },
    },
    ],

    location: {
        type: String,
        default: "",
    },

    feeling: {
        type: String,
        default: "",
    },

    likes:{
        type:[String],
        default:[]
    },

    // Who has bookmarked this post. Kept on the Post itself (same pattern
    // as `likes`) rather than on the User model, so this doesn't depend
    // on a User schema I haven't seen.
    savedBy:{
        type:[String],
        default:[]
    },

    comments: [CommentSchema]

},{timestamps:true});

module.exports = mongoose.model("Post", PostSchema);