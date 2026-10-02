const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const mongoose = require("mongoose");
const Post = require("../models/post");
const User = require("../models/user");
const Staff = require("../models/staff");
const Notification = require("../models/notification");
const { sendNotification } = require("../socket/index");

const MAX_DESC_LENGTH = 5000;
const MAX_COMMENT_LENGTH = 2000;

function validateCommentText(text) {
    return typeof text === "string" && text.trim().length > 0 && text.length <= MAX_COMMENT_LENGTH;
}


// Unseen-post count for the Feed icon badge — same pattern as
// /api/schedule/count: counts posts created since this account last
// opened the feed, excluding their own posts (you don't need a badge
// for content you posted yourself).
router.get("/count/:userId", authenticate, async (req, res) => {
    try {
        if (req.auth.id !== String(req.params.userId)) {
            return res.status(403).json({ message: "Access denied." });
        }

        const Model = req.auth.type === "Staff" ? Staff : User;
        const account = await Model.findById(req.auth.id).select("lastFeedView");

        if (!account) {
            return res.status(404).json({ message: "Account not found." });
        }

        const since = account.lastFeedView || new Date(0);

        const count = await Post.countDocuments({
            createdAt: { $gt: since },
            staffId: { $ne: req.auth.id },
        });

        res.status(200).json({ count });
    } catch (err) {
        console.error("GET /post/count/:userId failed:", err);
        res.status(500).json({ message: "Failed to fetch post count." });
    }
});

// Mark the feed as viewed — called when the user actually opens /feed,
// resetting the badge until new posts arrive after this moment.
router.put("/mark-viewed/:userId", authenticate, async (req, res) => {
    try {
        if (req.auth.id !== String(req.params.userId)) {
            return res.status(403).json({ message: "Access denied." });
        }

        const Model = req.auth.type === "Staff" ? Staff : User;
        await Model.findByIdAndUpdate(req.auth.id, { lastFeedView: new Date() });

        res.status(200).json({ message: "Feed marked as viewed." });
    } catch (err) {
        console.error("PUT /post/mark-viewed/:userId failed:", err);
        res.status(500).json({ message: "Failed to mark feed as viewed." });
    }
});


router.get("/profile/:staffId", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.staffId)) {
            return res.status(400).json({ message: "Invalid staff id." });
        }

        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
        const page = Math.max(Number(req.query.page) || 1, 1);

        const posts = await Post.find({ staffId: req.params.staffId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json(posts);
    } catch (err) {
        console.error("GET /post/profile/:staffId failed:", err);
        res.status(500).json({ message: "Failed to fetch posts." });
    }
});

// create a post
router.post("/", authenticate, async (req, res) => {
    try {
        if (req.auth.type !== "Staff") {
            return res.status(403).json("Only staff can create posts");
        }

        const staff = await Staff.findById(req.auth.id);
        if (!staff) return res.status(404).json("Staff not found");

        const MAX_MEDIA_ITEMS = 10;

        const rawMedia = Array.isArray(req.body.img) ? req.body.img : [];
        
        const media = rawMedia
            .filter((item) => item && typeof item === "object" && typeof item.url === "string" && item.url.trim() !== "")
            .filter((item) => ["image", "video"].includes(item.type))
            .slice(0, MAX_MEDIA_ITEMS);

        const newPost = new Post({
            staffId: staff._id,
            desc: typeof req.body.desc === "string" ? req.body.desc.slice(0, MAX_DESC_LENGTH) : "",
            img: media,
            tags: Array.isArray(req.body.tags) ? req.body.tags : [],
            location: typeof req.body.location === "string" ? req.body.location : undefined,
            feeling: typeof req.body.feeling === "string" ? req.body.feeling : undefined,
        });

        const savedPost = await newPost.save();

        // Notify followers about new post
        const followers = await User.find({ _id: { $in: staff.followers } });

        await Promise.all(
            followers.map(async (follower) => {
                const notification = await Notification.create({
                    senderId: staff._id,
                    senderModel: "Staff",
                    receiverId: follower._id,
                    receiverModel: "User",
                    postId: savedPost._id,
                    type: "post",
                    text: `${staff.username} shared a new post.`,
                });

                const populatedNotification = await Notification.findById(notification._id)
                    .populate("senderId", "username profilePicture");

                sendNotification(follower._id.toString(), populatedNotification);
            })
        );

        res.status(201).json(savedPost);
    } catch (err) {
        console.error("POST /post failed:", err);
        res.status(500).json({ message: "Failed to create post." });
    }
});

// update a post
router.put("/:id", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid post id." });
        }

        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json("Post not found");

        if (!(req.auth.type === "Staff" && String(post.staffId) === req.auth.id)) {
            return res.status(403).json("you can only update your post");
        }

        const updates = {};
        for (const key of ["desc", "img", "tags", "location", "feeling"]) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        // Same cap as creation — editing shouldn't be a way around it.
        if (typeof updates.desc === "string") {
            updates.desc = updates.desc.slice(0, MAX_DESC_LENGTH);
        }

        await post.updateOne({ $set: updates });
        res.status(200).json("the post has been updated");
    } catch (err) {
        console.error("PUT /post/:id failed:", err);
        res.status(500).json({ message: "Failed to update post." });
    }
});

// delete a post
router.delete("/:id", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid post id." });
        }

        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json("Post not found");

        if (!(req.auth.type === "Staff" && String(post.staffId) === req.auth.id)) {
            return res.status(403).json("you can only delete your post");
        }

        await post.deleteOne();
        res.status(200).json("the post has been deleted");
    } catch (err) {
        console.error("DELETE /post/:id failed:", err);
        res.status(500).json({ message: "Failed to delete post." });
    }
});

// like and dislike a post
router.put("/:id/like", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid post id." });
        }

        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json("Post not found");
        }

        const userId = req.auth.id;

        if (post.likes.map(String).includes(userId)) {
            await post.updateOne({ $pull: { likes: userId } });
            return res.status(200).json("disliked");
        }

        await post.updateOne({ $addToSet: { likes: userId } });

        let sender = await User.findById(userId);
        let senderModel = "User";

        if (!sender) {
            sender = await Staff.findById(userId);
            senderModel = "Staff";
        }

        const receiver = await Staff.findById(post.staffId);

        if (sender && receiver && sender._id.toString() !== receiver._id.toString()) {
            const notification = await Notification.create({
                senderId: sender._id,
                senderModel,
                receiverId: receiver._id,
                receiverModel: "Staff",
                postId: post._id,
                type: "like",
                text: `${sender.username} liked your post.`,
            });

            const populatedNotification = await Notification.findById(notification._id)
                .populate("senderId", "username profilePicture");

            sendNotification(receiver._id.toString(), populatedNotification);
        }

        res.status(200).json("liked");
    } catch (err) {
        console.error("PUT /post/:id/like failed:", err);
        res.status(500).json({ message: "Failed to like post." });
    }
});

// SAVE / UNSAVE A POST (bookmark toggle)
router.put("/:id/save", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid post id." });
        }

        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json("Post not found");
        }

        const userId = req.auth.id;

        if (post.savedBy.map(String).includes(userId)) {
            await post.updateOne({ $pull: { savedBy: userId } });
            return res.status(200).json("unsaved");
        }

        await post.updateOne({ $addToSet: { savedBy: userId } });
        res.status(200).json("saved");
    } catch (err) {
        console.error("PUT /post/:id/save failed:", err);
        res.status(500).json({ message: "Failed to save post." });
    }
});

// GET ALL POSTS A USER HAS SAVED
router.get("/saved/:userId", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user id." });
        }
        if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });

        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const posts = await Post.find({ savedBy: req.params.userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json(posts);
    } catch (err) {
        console.error("GET /post/saved/:userId failed:", err);
        res.status(500).json({ message: "Failed to fetch saved posts." });
    }
});

// GET TIMELINE POSTS
router.get("/timeline", async (req, res) => {
    try {
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const post = await Post.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);

        res.status(200).json(post);
    } catch (err) {
        console.error("GET /post/timeline failed:", err);
        res.status(500).json({ message: "Failed to fetch timeline." });
    }
});

// following posts
router.get("/following/:userId", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user id." });
        }

        const currentUser = await User.findById(req.params.userId);

        if (!currentUser || !currentUser.followings?.length) {
            return res.status(200).json([]);
        }

        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
        const page = Math.max(Number(req.query.page) || 1, 1);

        // Single query across every followed staff member instead of one
        // query per follow — the old version turned a large followings
        // list into hundreds/thousands of parallel DB calls per request.
        const merged = await Post.find({ staffId: { $in: currentUser.followings } })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.status(200).json(merged);
    } catch (err) {
        console.error("GET /post/following/:userId failed:", err);
        res.status(500).json({ message: "Failed to fetch following posts." });
    }
});

// GET SINGLE POST
router.get("/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid post id." });
        }

        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json("Post not found");
        }

        res.status(200).json(post);
    } catch (err) {
        console.error("GET /post/:id failed:", err);
        res.status(500).json({ message: "Failed to fetch post." });
    }
});

// COMMENT ON A POST
router.post("/:id/comment", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid post id." });
        }

        if (!validateCommentText(req.body.text)) {
            return res.status(400).json({
                message: `Comment text is required and must be <= ${MAX_COMMENT_LENGTH} characters.`,
            });
        }

        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json("Post not found");
        }

        post.comments.push({
            userId: req.auth.id,
            text: req.body.text.trim(),
            createdAt: new Date(),
        });

        await post.save();

        // The comment we just pushed is the last one in the array —
        // grab it so we can hand its real _id back to the frontend.
        const savedComment = post.comments[post.comments.length - 1];

        let sender = await User.findById(req.auth.id);
        let senderModel = "User";

        if (!sender) {
            sender = await Staff.findById(req.auth.id);
            senderModel = "Staff";
        }

        const receiver = await Staff.findById(post.staffId);

        if (sender && receiver && sender._id.toString() !== receiver._id.toString()) {
            const notification = await Notification.create({
                senderId: sender._id,
                senderModel,
                receiverId: receiver._id,
                receiverModel: "Staff",
                postId: post._id,
                type: "comment",
                text: `${sender.username} commented on your post.`,
            });

            const populatedNotification = await Notification.findById(notification._id)
                .populate("senderId", "username profilePicture");

            sendNotification(receiver._id.toString(), populatedNotification);
        }

        res.status(200).json(savedComment);
    } catch (err) {
        console.error("POST /post/:id/comment failed:", err);
        res.status(500).json({ message: "Failed to add comment." });
    }
});

// LIKE / UNLIKE A COMMENT
router.put("/:postId/comment/:commentId/like", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.commentId)) {
            return res.status(400).json({ message: "Invalid id." });
        }

        const post = await Post.findById(req.params.postId);

        if (!post) {
            return res.status(404).json("Post not found");
        }

        const comment = post.comments.id(req.params.commentId);

        if (!comment) {
            return res.status(404).json("Comment not found");
        }

        const userId = req.auth.id;

        if (comment.likes.map(String).includes(userId)) {
            comment.likes.pull(userId);
        } else {
            comment.likes.addToSet(userId);

            // Notify the comment's author (not the post owner) that their
            // comment got a like — skip if liking your own comment.
            // Compared as strings since comment.userId is a Mongoose value,
            // not a plain string — a raw !== here would never match.
            if (String(comment.userId) !== String(userId)) {
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

                    const populatedNotification = await Notification.findById(notification._id)
                        .populate("senderId", "username profilePicture");

                    sendNotification(receiver._id.toString(), populatedNotification);
                }
            }
        }

        await post.save();

        res.status(200).json(comment);
    } catch (err) {
        console.error("PUT /post/:postId/comment/:commentId/like failed:", err);
        res.status(500).json({ message: "Failed to like comment." });
    }
});

// REPLY TO A COMMENT
router.post("/:postId/comment/:commentId/reply", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.postId) || !mongoose.isValidObjectId(req.params.commentId)) {
            return res.status(400).json({ message: "Invalid id." });
        }

        if (!validateCommentText(req.body.text)) {
            return res.status(400).json({
                message: `Reply text is required and must be <= ${MAX_COMMENT_LENGTH} characters.`,
            });
        }

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
            text: req.body.text.trim(),
            createdAt: new Date(),
        });

        await post.save();

        const savedReply = comment.replies[comment.replies.length - 1];

        // Same fix as the like route above — string comparison, not raw !==.
        if (String(comment.userId) !== String(req.auth.id)) {
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

                const populatedNotification = await Notification.findById(notification._id)
                    .populate("senderId", "username profilePicture");

                sendNotification(receiver._id.toString(), populatedNotification);
            }
        }

        res.status(200).json(savedReply);
    } catch (err) {
        console.error("POST /post/:postId/comment/:commentId/reply failed:", err);
        res.status(500).json({ message: "Failed to add reply." });
    }
});

module.exports = router;