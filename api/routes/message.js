const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const mongoose = require("mongoose");
const Message = require("../models/message");
const Conversation = require("../models/conversation");
const Notification = require("../models/notification");
const User = require("../models/user");
const Staff = require("../models/staff");
const { sendNotification, sendMessage } = require("../socket/index");

// Add Message
router.post("/", authenticate, async (req, res) => {
  try {
    if (String(req.body.sender) !== req.auth.id) return res.status(403).json({ message: "Invalid sender identity." });
    const conversation = await Conversation.findById(req.body.conversationId);
    if (!conversation || !conversation.members.map(String).includes(req.auth.id)) {
      return res.status(403).json({ message: "You are not a member of this conversation." });
    }

    const rawText = typeof req.body.text === "string" ? req.body.text.trim() : "";
    const media = req.body.media;

    const hasValidMedia =
      media &&
      typeof media.url === "string" &&
      media.url.trim() !== "" &&
      ["image", "video"].includes(media.type);

    if (!rawText && !hasValidMedia) {
      return res.status(400).json({ message: "A message needs text, media, or both." });
    }

    if (rawText.length > 10000) {
      return res.status(400).json({ message: "Message text must be <= 10,000 characters." });
    }

    // Only take exactly what a plain chat message needs from the client.
    // Fields like `type`, `bookingId`, and `status` are set by the server
    // elsewhere (e.g. booking.js, payment.js) when a message represents a
    // booking event — a user-authored message can never claim to be one of
    // those, so we never spread req.body into the document.
    const newMessage = new Message({
      sender: req.auth.id,
      conversationId: conversation._id,
      text: rawText,
      media: hasValidMedia
        ? { url: media.url.trim(), type: media.type }
        : undefined,
      type: "text",
    });
    const savedMessage = await newMessage.save();

    
    // Find the receiver from the already-authorized conversation.
    if (conversation) {
      // Find receiver
      const receiverId = conversation.members.find(
        (id) => id.toString() !== req.auth.id
      );

      // Determine sender model
      let sender = await User.findById(req.auth.id);
      let senderModel = "User";

      if (!sender) {
        sender = await Staff.findById(req.auth.id);
        senderModel = "Staff";
      }

      // Determine receiver model
      let receiver = await User.findById(receiverId);
      let receiverModel = "User";

      if (!receiver) {
        receiver = await Staff.findById(receiverId);
        receiverModel = "Staff";
      }

      if (sender && receiver) {
        const notification = await Notification.create({
          senderId: sender._id,
          senderModel,
          receiverId: receiver._id,
          receiverModel,
          conversationId: conversation._id,
          type: "message",
          text: `${sender.username} sent you a message.`,
        });

        // Populate sender before sending
        const populatedNotification =
          await Notification.findById(notification._id)
            .populate("senderId", "username profilePicture")
            .populate("receiverId", "username profilePicture");

        sendNotification(
          receiver._id.toString(),
          populatedNotification
        );

        // Send the full saved message (with _id) so the client can key on it
        // and later match it against getMessageUpdate events.
        sendMessage(receiver._id.toString(), savedMessage);
      }
    }

    res.status(200).json(savedMessage);
  } catch (err) {
    console.error("POST /message failed:", err);
    res.status(500).json({ message: "Failed to send message." });
  }
});

// Mark all messages as read for a given user (across all their conversations)
router.put("/read/:userId", authenticate, async (req, res) => {
  try {
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
    const conversations = await Conversation.find({
      members: req.params.userId,
    });

    const conversationIds = conversations.map((c) => c._id.toString());

    await Message.updateMany(
      {
        conversationId: { $in: conversationIds },
        sender: { $ne: req.params.userId },
        read: false,
      },
      { $set: { read: true } }
    );

    res.status(200).json("Messages marked as read.");
  } catch (err) {
    console.error("PUT /message/read failed:", err);
    res.status(500).json({ message: "Failed to mark messages as read." });
  }
});

// Get Messages
router.get("/:conversationId", authenticate, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !conversation.members.map(String).includes(req.auth.id)) {
      return res.status(403).json({ message: "Access denied." });
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);

    // Sort descending + paginate to get the most RECENT page of messages,
    // then reverse in JS so the client still receives oldest-to-newest for display.
    // (A second .sort() here would silently overwrite the first, since Mongoose
    // builds one query object rather than chaining sorts sequentially.)
    const messages = await Message.find({ conversationId: req.params.conversationId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({
        path: "bookingId",
        select: "services appointmentDate appointmentTime address paymentMethod total contact status customerId staffId",
        populate: [
          { path: "customerId", select: "username profilePicture" },
          { path: "staffId", select: "username profilePicture location workType" },
        ],
      });

    res.status(200).json(messages.reverse());
  } catch (err) {
    console.error("GET /message/:conversationId failed:", err);
    res.status(500).json({ message: "Failed to fetch messages." });
  }
});

// Mark messages read for ONE conversation (used when that conversation is opened)
router.put("/conversation/:conversationId/read", authenticate, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || !conversation.members.map(String).includes(req.auth.id)) {
      return res.status(403).json({ message: "Access denied." });
    }

    await Message.updateMany(
      {
        conversationId: req.params.conversationId,
        sender: { $ne: req.auth.id },
        read: false,
      },
      { $set: { read: true } }
    );

    res.status(200).json("Messages marked as read.");
  } catch (err) {
    console.error("PUT /message/conversation/:conversationId/read failed:", err);
    res.status(500).json({ message: "Failed to mark conversation as read." });
  }
});

// Total unread message count across ALL the user's conversations —
// independent of Notification.isRead. This is the mail icon's source of
// truth; it changes only when messages are actually read (per-conversation),
// never when a notification is marked read on the notifications page.
router.get("/unread/:userId", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });

    const conversations = await Conversation.find({ members: req.params.userId }).select("_id");
    const conversationIds = conversations.map((c) => c._id.toString());

    const count = await Message.countDocuments({
      conversationId: { $in: conversationIds },
      sender: { $ne: req.params.userId },
      read: false,
    });

    res.status(200).json({ count });
  } catch (err) {
    console.error("GET /message/unread/:userId failed:", err);
    res.status(500).json({ message: "Failed to fetch unread message count." });
  }
});

module.exports = router;