const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const mongoose = require("mongoose");
const Notification = require("../models/notification");

router.post("/", authenticate, async (req, res) => {
    return res.status(403).json({ message: "Direct notification creation is not allowed." });
});

router.get("/count/:userId", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });

    const count = await Notification.countDocuments({
      receiverId: req.params.userId,
      isRead: false,
    });

    res.status(200).json(count);
  } catch (err) {
    console.error("GET /notification/count/:userId failed:", err);
    res.status(500).json({ message: "Failed to fetch notification count." });
  }
});

router.get("/unread/general/:userId", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });

    const count = await Notification.countDocuments({
      receiverId: req.params.userId,
      isRead: false,
      type: {
        $in: ["follow", "like", "comment", "booking", "appointment", "payment", "service", "order", "post", "message","delivery"]
      }
    });

    res.status(200).json({ count });
  } catch (err) {
    console.error("GET /notification/unread/general/:userId failed:", err);
    res.status(500).json({ message: "Failed to fetch notification count." });
  }
});

router.get("/unread/delivery/:userId", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({
        message: "Invalid user id.",
      });
    }

    if (req.auth.id !== String(req.params.userId)) {
      return res.status(403).json({
        message: "Access denied.",
      });
    }

    const count = await Notification.countDocuments({
      receiverId: req.params.userId,
      type: "delivery",
      isRead: false,
    });

    return res.status(200).json({ count });
  } catch (err) {
    console.error(
      "GET /notification/unread/delivery/:userId failed:",
      err
    );

    return res.status(500).json({
      message: "Failed to fetch delivery notification count.",
    });
  }
});

router.get("/unread/messages/:userId", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });

    const count = await Notification.countDocuments({
      receiverId: req.params.userId,
      type: "message",
      isRead: false
    });

    res.status(200).json({ count });
  } catch (err) {
    console.error("GET /notification/unread/messages/:userId failed:", err);
    res.status(500).json({ message: "Failed to fetch notification count." });
  }
});

router.get("/unread/posts/:userId", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });

    const count = await Notification.countDocuments({
      receiverId: req.params.userId,
      type: "post",
      isRead: false
    });

    res.status(200).json({ count });
  } catch (err) {
    console.error("GET /notification/unread/posts/:userId failed:", err);
    res.status(500).json({ message: "Failed to fetch notification count." });
  }
});

router.get("/unread/:userId", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user id." });
        }
        if (req.auth.id !== String(req.params.userId)) {
            return res.status(403).json({ message: "Access denied." });
        }

        const count = await Notification.countDocuments({
            receiverId: req.params.userId,
            isRead: false
        });

        res.status(200).json({ count });
    } catch (err) {
        console.error("GET /notification/unread/:userId failed:", err);
        res.status(500).json({ message: "Failed to fetch notification count." });
    }
});

router.get("/:userId", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user id." });
        }
        if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });

        const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const notifications = await Notification.find({ receiverId: req.params.userId })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate({
                path: "senderId",
                select: "username profilePicture"
            })
            .sort({ createdAt: -1 });

        res.status(200).json(notifications);
    } catch (err) {
        console.error("GET /notification/:userId failed:", err);
        res.status(500).json({ message: "Failed to fetch notifications." });
    }
});

router.put("/:id/read", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid notification id." });
        }

        const existing = await Notification.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Notification not found." });
        if (String(existing.receiverId) !== req.auth.id) return res.status(403).json({ message: "Access denied." });

        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );

        res.status(200).json(notification);
    } catch (err) {
        console.error("PUT /notification/:id/read failed:", err);
        res.status(500).json({ message: "Failed to mark notification as read." });
    }
});

router.put("/read-posts/:userId", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user id." });
        }
        if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });

        await Notification.updateMany(
            { receiverId: req.params.userId, type: "post", isRead: false },
            { $set: { isRead: true } }
        );
        res.status(200).json("Post notifications marked as read.");
    } catch (err) {
        console.error("PUT /notification/read-posts/:userId failed:", err);
        res.status(500).json({ message: "Failed to mark notifications as read." });
    }
});

router.put("/read-all/:userId", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ message: "Invalid user id." });
        }
        if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });

        await Notification.updateMany(
            { receiverId: req.params.userId, isRead: false },
            { $set: { isRead: true } }
        );
        res.status(200).json("All notifications marked as read.");
    } catch (err) {
        console.error("PUT /notification/read-all/:userId failed:", err);
        res.status(500).json({ message: "Failed to mark notifications as read." });
    }
});

router.delete("/:id", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: "Invalid notification id." });
        }

        const existing = await Notification.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Notification not found." });
        if (String(existing.receiverId) !== req.auth.id) return res.status(403).json({ message: "Access denied." });

        await Notification.findByIdAndDelete(req.params.id);

        res.status(200).json("Notification deleted.");
    } catch (err) {
        console.error("DELETE /notification/:id failed:", err);
        res.status(500).json({ message: "Failed to delete notification." });
    }
});

module.exports = router;