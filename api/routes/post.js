const { authenticate } = require("../middleware/auth");
const router = require("express").Router(); 
const Post = require("../models/post");
const User = require("../models/user");
const Staff = require("../models/staff");
const Notification = require("../models/notification");
const { sendNotification } = require("../../socket/index");


router.get("/profile/:staffId", async (req,res)=>{
    try{

        const posts = await Post.find({
            staffId:req.params.staffId
        }).sort({ createdAt:-1 });

        res.status(200).json(posts);

    }catch(err){
        res.status(500).json(err);
    }
});

//create a post
router.post("/", authenticate, async(req,res)=>{

    try{

        if (req.auth.type !== "Staff") {
            return res.status(403).json("Only staff can create posts");
        }

        const staff = await Staff.findById(req.auth.id);
        if (!staff) return res.status(404).json("Staff not found");

        const newPost = new Post({
            staffId: staff._id,
            desc: typeof req.body.desc === "string" ? req.body.desc.slice(0, 5000) : "",
            img: req.body.img,
            tags: req.body.tags,
            location: req.body.location,
            feeling: req.body.feeling,
        });

        const savedPost = await newPost.save();

        // Notify followers about new post
        const followers = await User.find({
            _id: { $in: staff.followers }
        });

        for (const follower of followers) {

            const notification = await Notification.create({
                senderId: staff._id,
                senderModel: "Staff",

                receiverId: follower._id,
                receiverModel: "User",

                postId: savedPost._id,

                type: "post",

                text: `${staff.username} shared a new post.`
            });

            const populatedNotification =
                await Notification.findById(notification._id)
                .populate("senderId", "username profilePicture");

            sendNotification(
                follower._id.toString(),
                populatedNotification
            );
        }

        res.status(201).json(savedPost);

    }catch(err){

        res.status(500).json(err);

    }

});



// update a post
router.put("/:id", authenticate, async (req, res)=> {
    try{
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json("Post not found");
        if (req.auth.type === "Staff" && String(post.staffId) === req.auth.id) {
            const updates = {};
            for (const key of ["desc", "img", "tags", "location", "feeling"]) {
                if (req.body[key] !== undefined) updates[key] = req.body[key];
            }
            await post.updateOne({ $set: updates });
            res.status(200).json("the post has been updated");
        }else{
            res.status(403).json("you can only update your post");
        }
    }catch(err){
        res.status(500).json(err)
    }
})

// delete a post
router.delete("/:id", authenticate, async (req, res)=> {
    try{
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json("Post not found");
        if (req.auth.type === "Staff" && String(post.staffId) === req.auth.id) {
            await post.deleteOne();
            res.status(200).json("the post has been deleted");
        }else{
            res.status(403).json("you can only delete your post");
        }
    }catch(err){
        res.status(500).json(err)
    }
})

// like and dislike a post
router.put("/:id/like", authenticate, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json("Post not found");
        }

        const userId = req.auth.id;

        if (post.likes.includes(userId)) {
        await post.updateOne({
            $pull: { likes: userId },
        });

        return res.status(200).json("disliked");
        }

        await post.updateOne({
            $addToSet: { likes: userId },
        });

        let sender = await User.findById(userId);
        let senderModel = "User";

        if (!sender) {
            sender = await Staff.findById(userId);
            senderModel = "Staff";
        }

        const receiver = await Staff.findById(post.staffId);

        if (
            sender &&
            receiver &&
            sender._id.toString() !== receiver._id.toString()
        ) {
        const notification = await Notification.create({
            senderId: sender._id,
            senderModel,
            receiverId: receiver._id,
            receiverModel: "Staff",
            postId: post._id,
            type: "like",
            text: `${sender.username} liked your post.`,
        });

        const populatedNotification =
            await Notification.findById(notification._id)
            .populate("senderId", "username profilePicture");

        sendNotification(
            receiver._id.toString(),
            populatedNotification
        );
        }

        res.status(200).json("liked");
    } catch (err) {
        res.status(500).json(err);
    }
});


// SAVE / UNSAVE A POST (bookmark toggle)
router.put("/:id/save", authenticate, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json("Post not found");
        }

        const userId = req.auth.id;

        if (post.savedBy.includes(userId)) {
            await post.updateOne({ $pull: { savedBy: userId } });
            return res.status(200).json("unsaved");
        }

        await post.updateOne({ $addToSet: { savedBy: userId } });
        res.status(200).json("saved");
    } catch (err) {
        res.status(500).json(err);
    }
});

// GET ALL POSTS A USER HAS SAVED
router.get("/saved/:userId", authenticate, async (req, res) => {
    try {
        if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const posts = await Post.find({ savedBy: req.params.userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json(posts);
    } catch (err) {
        res.status(500).json(err);
    }
});

// GET TIMELINE POSTS
router.get("/timeline", async(req,res)=>{

    try{
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const post = await Post.find().sort({createdAt:-1}).skip((page - 1) * limit).limit(limit);

        res.status(200).json(post);

    }catch(err){

        console.log(err);

        res.status(500).json(err);

    }

});



// following posts
router.get("/following/:userId", authenticate, async (req,res)=>{
    try {
        const currentUser = await User.findById(req.params.userId);

        if (!currentUser || !currentUser.followings) {
            return res.status(200).json([]);
        }

        const followingPosts = await Promise.all(
            currentUser.followings.map((friendId) => {
                return Post.find({ staffId: friendId }).sort({ createdAt: -1 });
            })
        );

        const merged = followingPosts.flat().sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        res.status(200).json(merged);

    } catch (err) {
        res.status(500).json(err);
    }
});

// GET SINGLE POST
router.get("/:id", async (req,res)=>{
    try{
        const post = await Post.findById(
            req.params.id
        );

        res.status(200).json(post);

    }catch(err){
        res.status(500).json(err);
    }
});

// COMMENT ON A POST
router.post("/:id/comment", authenticate, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json("Post not found");
        }

        post.comments.push({
            userId: req.auth.id,
            text: req.body.text,
            createdAt: new Date(),
        });

        await post.save();

        // The comment we just pushed is the last one in the array —
        // grab it so we can hand its real _id back to the frontend.
        // Without this, the client has no way to like/reply to a comment
        // it just created without doing a full refetch.
        const savedComment = post.comments[post.comments.length - 1];

        let sender = await User.findById(req.auth.id);
        let senderModel = "User";

        if (!sender) {
            sender = await Staff.findById(req.auth.id);
            senderModel = "Staff";
        }

        const receiver = await Staff.findById(post.staffId);

        if (
            sender &&
            receiver &&
            sender._id.toString() !== receiver._id.toString()
        ) {
        const notification = await Notification.create({
            senderId: sender._id,
            senderModel,
            receiverId: receiver._id,
            receiverModel: "Staff",
            postId: post._id,
            type: "comment",
            text: `${sender.username} commented on your post.`,
        });

        const populatedNotification =
            await Notification.findById(notification._id)
            .populate("senderId", "username profilePicture");

        sendNotification(
            receiver._id.toString(),
            populatedNotification
        );
        }

        res.status(200).json(savedComment);
    } catch (err) {
        res.status(500).json(err);
    }
});

// LIKE / UNLIKE A COMMENT
router.put("/:postId/comment/:commentId/like", authenticate, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);

        if (!post) {
            return res.status(404).json("Post not found");
        }

        const comment = post.comments.id(req.params.commentId);

        if (!comment) {
            return res.status(404).json("Comment not found");
        }

        const userId = req.auth.id;

        if (comment.likes.includes(userId)) {
            comment.likes.pull(userId);
        } else {
            comment.likes.addToSet(userId);

            // Notify the comment's author (not the post owner) that
            // their comment got a like — skip if liking your own comment.
            if (comment.userId !== userId) {
                let sender = await User.findById(userId);
                let senderModel = "User";

                if (!sender) {
                    sender = await Staff.findById(userId);
                    senderModel = "Staff";
                }

                let receiver = await User.findById(comment.userId);
                let receiverModel = "User";

                if (!receiver) {
                    receiver = await Staff.findById(comment.userId);
                    receiverModel = "Staff";
                }

                if (sender && receiver) {
                    const notification = await Notification.create({
                        senderId: sender._id,
                        senderModel,
                        receiverId: receiver._id,
                        receiverModel,
                        postId: post._id,
                        type: "commentLike",
                        text: `${sender.username} liked your comment.`,
                    });

                    const populatedNotification = await Notification.findById(
                        notification._id
                    ).populate("senderId", "username profilePicture");

                    sendNotification(receiver._id.toString(), populatedNotification);
                }
            }
        }

        await post.save();

        res.status(200).json(comment);
    } catch (err) {
        res.status(500).json(err);
    }
});

// REPLY TO A COMMENT
router.post("/:postId/comment/:commentId/reply", authenticate, async (req, res) => {
    try {
        const post = await Post.findById(req.params.postId);

        if (!post) {
            return res.status(404).json("Post not found");
        }

        const comment = post.comments.id(req.params.commentId);

        if (!comment) {
            return res.status(404).json("Comment not found");
        }

        comment.replies.push({
            userId: req.auth.id,
            text: req.body.text,
            createdAt: new Date(),
        });

        await post.save();

        const savedReply = comment.replies[comment.replies.length - 1];

        // Notify the original commenter that someone replied — skip if
        // replying to your own comment.
        if (comment.userId !== req.auth.id) {
            let sender = await User.findById(req.auth.id);
            let senderModel = "User";

            if (!sender) {
                sender = await Staff.findById(req.auth.id);
                senderModel = "Staff";
            }

            let receiver = await User.findById(comment.userId);
            let receiverModel = "User";

            if (!receiver) {
                receiver = await Staff.findById(comment.userId);
                receiverModel = "Staff";
            }

            if (sender && receiver) {
                const notification = await Notification.create({
                    senderId: sender._id,
                    senderModel,
                    receiverId: receiver._id,
                    receiverModel,
                    postId: post._id,
                    type: "commentReply",
                    text: `${sender.username} replied to your comment.`,
                });

                const populatedNotification = await Notification.findById(
                    notification._id
                ).populate("senderId", "username profilePicture");

                sendNotification(receiver._id.toString(), populatedNotification);
            }
        }

        res.status(200).json(savedReply);
    } catch (err) {
        res.status(500).json(err);
    }
});


module.exports = router;