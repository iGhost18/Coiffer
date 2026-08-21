const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const Message = require("../models/message");
const Conversation = require("../models/conversation");
const Notification = require("../models/notification");
const User = require("../models/user");
const Staff = require("../models/staff");
const { sendNotification, sendMessage } = require("../../socket/index");

// Add Message
router.post("/", authenticate, async (req, res) => {
  try {
    if (String(req.body.sender) !== req.auth.id) return res.status(403).json({ message: "Invalid sender identity." });
    const conversation = await Conversation.findById(req.body.conversationId);
    if (!conversation || !conversation.members.map(String).includes(req.auth.id)) {
      return res.status(403).json({ message: "You are not a member of this conversation." });
    }
    if (typeof req.body.text !== "string" || req.body.text.trim().length === 0 || req.body.text.length > 10000) {
      return res.status(400).json({ message: "Message text is required and must be <= 10,000 characters." });
    }
    const newMessage = new Message({
      ...req.body,
      sender: req.auth.id,
      conversationId: conversation._id,
    });
    const savedMessage = await newMessage.save();

    // Find the receiver from the already-authorized conversation.
    if (conversation) {
      // Find receiver
      const receiverId = conversation.members.find(
        (id) => id.toString() !== req.body.sender.toString()
      );

      // Determine sender model
      let sender = await User.findById(req.body.sender);
      let senderModel = "User";

      if (!sender) {
        sender = await Staff.findById(req.body.sender);
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
    res.status(500).json(err);
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
    res.status(500).json(err);
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
    res.status(500).json(err);
  }
});

module.exports = router;