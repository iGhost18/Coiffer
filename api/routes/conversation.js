const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const mongoose = require("mongoose");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const User = require("../models/user");
const Staff = require("../models/staff");

// Get a member's profile info, checking both User and Staff
router.get("/member", authenticate, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: "Member id is required." });

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid member id." });
    }

    let person = await User.findById(id).select("username profilePicture");
    let memberType = "User";

    if (!person) {
      person = await Staff.findById(id).select("username profilePicture");
      memberType = "Staff";
    }

    if (!person) return res.status(404).json({ message: "Not found" });

    res.status(200).json({ ...person._doc, memberType });
  } catch (err) {
    console.error("GET /conversation/member failed:", err);
    res.status(500).json({ message: "Failed to fetch member." });
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

    if (!receiverId || String(receiverId) === senderId) {
      return res.status(400).json({ message: "A different receiver is required." });
    }

    if (!mongoose.isValidObjectId(receiverId)) {
      return res.status(400).json({ message: "Invalid receiver id." });
    }

    // Confirm the receiver is an actual account before creating a
    // conversation around it — otherwise a bad/garbage id gets saved and
    // breaks later when message.js tries to resolve it to a real sender.
    const receiverExists =
      (await User.exists({ _id: receiverId })) || (await Staff.exists({ _id: receiverId }));

    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

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
    console.error("POST /conversation failed:", err);
    res.status(500).json({ message: "Failed to create conversation." });
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

    const conversationIds = conversations.map((c) => c._id.toString());

    const unreadCounts = await Message.aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds },
          sender: { $ne: req.params.userId },
          read: false,
        },
      },
      {
        $group: {
          _id: "$conversationId",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(unreadCounts.map((u) => [u._id, u.count]));

    const withUnread = conversations.map((c) => ({
      ...c.toObject(),
      unreadCount: countMap.get(c._id.toString()) || 0,
    }));

    res.status(200).json(withUnread);
  } catch (err) {
    console.error("GET /conversation/:userId failed:", err);
    res.status(500).json({ message: "Failed to fetch conversations." });
  }
});

module.exports = router;