const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const HomepageService = require("../models/homepageService");
const { sendHomepageServiceUpdate } = require("../../socket/index");

router.get("/", async (req, res) => {
  try {
    const homepageServices = await HomepageService.find().sort({ createdAt: -1 });
    res.status(200).json(homepageServices);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const newHomepageService = new HomepageService(req.body);
    const saved = await newHomepageService.save();

    sendHomepageServiceUpdate("add", saved);

    res.status(200).json(saved);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const updated = await HomepageService.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    sendHomepageServiceUpdate("update", updated);

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await HomepageService.findByIdAndDelete(req.params.id);

    sendHomepageServiceUpdate("delete", { _id: req.params.id });

    res.status(200).json("Homepage service deleted.");
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;