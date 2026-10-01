const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const PushSubscription = require("../models/pushSubscription");

router.get("/vapid-public-key", (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

router.post("/subscribe", authenticate, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "Invalid subscription." });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        endpoint,
        keys,
        ownerId: req.auth.id,
        ownerModel: req.auth.type,
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("POST /push/subscribe failed:", err);
    res.status(500).json({ message: "Failed to save subscription." });
  }
});

router.post("/unsubscribe", authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.findOneAndDelete({ endpoint, ownerId: req.auth.id });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("POST /push/unsubscribe failed:", err);
    res.status(500).json({ message: "Failed to remove subscription." });
  }
});

module.exports = router;