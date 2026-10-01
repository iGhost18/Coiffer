const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const mongoose = require("mongoose");
const HomepageService = require("../models/homepageService");
const { sendHomepageServiceUpdate } = require("../../socket/index");

router.get("/", async (req, res) => {
  try {
    const homepageServices = await HomepageService.find().sort({ createdAt: -1 });
    res.status(200).json(homepageServices);
  } catch (err) {
    console.error("GET /homepage-services failed:", err);
    res.status(500).json({ message: "Failed to fetch homepage services." });
  }
});

router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const newHomepageService = new HomepageService(req.body);
    const saved = await newHomepageService.save();

    sendHomepageServiceUpdate("add", saved);

    res.status(201).json(saved);
  } catch (err) {
    console.error("POST /homepage-services failed:", err);
    res.status(500).json({ message: "Failed to create homepage service." });
  }
});

router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid homepage service id." });
    }

    const updated = await HomepageService.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Homepage service not found." });
    }

    sendHomepageServiceUpdate("update", updated);

    res.status(200).json(updated);
  } catch (err) {
    console.error("PUT /homepage-services/:id failed:", err);
    res.status(500).json({ message: "Failed to update homepage service." });
  }
});

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid homepage service id." });
    }

    const deleted = await HomepageService.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Homepage service not found." });
    }

    sendHomepageServiceUpdate("delete", { _id: req.params.id });

    res.status(200).json("Homepage service deleted.");
  } catch (err) {
    console.error("DELETE /homepage-services/:id failed:", err);
    res.status(500).json({ message: "Failed to delete homepage service." });
  }
});

module.exports = router;