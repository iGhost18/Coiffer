const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const Notification = require("../models/notification");

router.post("/", authenticate, async(req,res)=>{
    return res.status(403).json({ message: "Direct notification creation is not allowed." });
});


router.get("/count/:userId", authenticate, async (req, res) => {
  try {
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
    const count = await Notification.countDocuments({
      receiverId: req.params.userId,
      isRead: false,
    });

    res.status(200).json(count);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/unread/general/:userId", authenticate, async (req, res) => {
  try {
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
    const count = await Notification.countDocuments({
      receiverId: req.params.userId,
      isRead: false,
      type: {
        $in: ["follow", "like", "comment", "booking", "appointment", "payment", "service"]
      }
    });

    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json(err);
  }
});


router.get("/unread/messages/:userId", authenticate, async (req, res) => {
  try {
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
    const count = await Notification.countDocuments({
      receiverId: req.params.userId,
      type: "message",
      isRead: false
    });

    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json(err);
  }
});


router.get("/unread/posts/:userId", authenticate, async (req, res) => {
  try {
    if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
    const count = await Notification.countDocuments({
      receiverId: req.params.userId,
      type: "post",
      isRead: false
    });

    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/unread/:userId", authenticate, async (req, res) => {
    try {
        if (req.auth.id !== String(req.params.userId)) {
            return res.status(403).json({ message: "Access denied." });
        }
        const count = await Notification.countDocuments({
            receiverId: req.params.userId,
            isRead: false
        });

        res.status(200).json({ count });

    } catch (err) {
        res.status(500).json(err);
    }
});

router.get("/:userId", authenticate, async(req,res)=>{

    try{
        if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
        const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const notifications = await Notification.find({ receiverId:req.params.userId })
            .skip((page - 1) * limit)
            .limit(limit)
        .populate({
            path:"senderId",
            select:"username profilePicture"
        })
        .sort({
            createdAt:-1
        });

        res.status(200).json(notifications);

    }catch(err){

        res.status(500).json(err);

    }

});


router.put("/:id/read", authenticate, async (req, res) => {
    try {

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
        res.status(500).json(err);
    }
});

router.put("/read-posts/:userId", authenticate, async (req, res) => {
    try {
        if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
        await Notification.updateMany(
            { receiverId: req.params.userId, type: "post", isRead: false },
            { $set: { isRead: true } }
        );
        res.status(200).json("Post notifications marked as read.");
    } catch (err) {
        res.status(500).json(err);
    }
});

router.put("/read-all/:userId", authenticate, async (req, res) => {
    try {
        if (req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
        await Notification.updateMany(
            { receiverId: req.params.userId, isRead: false },
            { $set: { isRead: true } }
        );
        res.status(200).json("All notifications marked as read.");
    } catch (err) {
        res.status(500).json(err);
    }
});

router.delete("/:id", authenticate, async (req, res) => {
    try {
        const existing = await Notification.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Notification not found." });
        if (String(existing.receiverId) !== req.auth.id) return res.status(403).json({ message: "Access denied." });
        await Notification.findByIdAndDelete(req.params.id);

        res.status(200).json("Notification deleted.");

    } catch (err) {
        res.status(500).json(err);
    }
});



module.exports = router;