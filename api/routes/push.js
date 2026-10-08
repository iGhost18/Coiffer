const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const PushSubscription = require("../models/pushSubscription");

router.get("/vapid-public-key", authenticate, (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ message: "Push not configured." });
  }
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

router.post("/subscribe", authenticate, async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    typeof keys?.p256dh !== "string" ||
    typeof keys?.auth !== "string"
  ) {
    return res.status(400).json({ message: "Invalid subscription." });
  }

  try {
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        ownerId: req.auth.id,
        ownerModel: req.auth.type,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ message: "Subscribed." });
  } catch (err) {
    console.error("POST /push/subscribe failed:", err);
    res.status(500).json({ message: "Failed to save subscription." });
  }
});

router.post("/unsubscribe", authenticate, async (req, res) => {
  const { endpoint } = req.body || {};
  if (typeof endpoint !== "string") {
    return res.status(400).json({ message: "Endpoint required." });
  }
  try {
    await PushSubscription.deleteOne({ endpoint, ownerId: req.auth.id });
    res.status(200).json({ message: "Unsubscribed." });
  } catch (err) {
    console.error("POST /push/unsubscribe failed:", err);
    res.status(500).json({ message: "Failed to unsubscribe." });
  }
});

module.exports = router;