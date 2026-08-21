const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const Conversation = require("../models/conversation");
const User = require("../models/user");
const Staff = require("../models/staff");

// Get a member's profile info, checking both User and Staff
router.get("/member", authenticate, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: "Member id is required." });
    let person = await User.findById(id).select("username profilePicture");
    let memberType = "User";

    if (!person) {
      person = await Staff.findById(id).select("username profilePicture");
      memberType = "Staff";
    }

    if (!person) return res.status(404).json({ message: "Not found" });

    res.status(200).json({ ...person._doc, memberType });
  } catch (err) {
    res.status(500).json(err);
  }
});

// Create or get existing conversation
router.post("/", authenticate, async (req, res) => {
  try {
    if (![req.body.senderId, req.body.receiverId].map(String).includes(req.auth.id)) {
      return res.status(403).json({ message: "You can only create conversations involving yourself." });
    }
    const senderId = req.auth.id;
    const receiverId = String(req.body.senderId) === req.auth.id ? req.body.receiverId : req.body.senderId;
    if (!receiverId || String(receiverId) === senderId) return res.status(400).json({ message: "A different receiver is required." });
    const existingConversation = await Conversation.findOne({
      members: { $all: [senderId, receiverId], $size: 2 },
    });

    if (existingConversation) {
      return res.status(200).json(existingConversation);
    }

    const newConversation = new Conversation({
      members: [senderId, receiverId],
    });

    const savedConversation = await newConversation.save();

    res.status(200).json(savedConversation);
  } catch (err) {
    res.status(500).json(err);
  }
});

// Get conversations of a user
router.get("/:userId", authenticate, async (req, res) => {
  try {
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const conversations = await Conversation.find({
      members: { $in: [req.params.userId] },
    }).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit);

    res.status(200).json(conversations);
  } catch (err) {
    res.status(500).json(err);
  }
});


module.exports = router;