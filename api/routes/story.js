const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const mongoose = require("mongoose");
const Story = require("../models/story");
const User = require("../models/user");
const Staff = require("../models/staff");

const MAX_CAPTION_LENGTH = 300;

// Create a story — any authenticated User or Staff account.
router.post("/", authenticate, async (req, res) => {
  try {
    const { url, type, caption } = req.body;

    if (!url || typeof url !== "string" || url.trim() === "") {
      return res.status(400).json({ message: "Media url is required." });
    }
    if (!["image", "video"].includes(type)) {
      return res.status(400).json({ message: "Media type must be image or video." });
    }
    if (caption !== undefined && (typeof caption !== "string" || caption.length > MAX_CAPTION_LENGTH)) {
      return res.status(400).json({ message: `Caption must be a string under ${MAX_CAPTION_LENGTH} characters.` });
    }

    const newStory = new Story({
      authorId: req.auth.id,
      authorModel: req.auth.type,
      media: { url: url.trim(), type },
      caption: caption ? caption.trim() : "",
    });

    const savedStory = await newStory.save();
    res.status(201).json(savedStory);
  } catch (err) {
    console.error("POST /story failed:", err);
    res.status(500).json({ message: "Failed to create story." });
  }
});

// Active-stories feed, grouped by author, current user's own group first.
router.get("/feed", authenticate, async (req, res) => {
  try {
    const stories = await Story.find({ expiresAt: { $gt: new Date() } })
      .sort({ createdAt: 1 }) // oldest first WITHIN each author's group
      .populate({
        path: "authorId",
        select: "username profilePicture",
      });

    const groupsByAuthor = new Map();

    for (const story of stories) {
      if (!story.authorId) continue; // author account deleted mid-story-life
      const key = story.authorId._id.toString();

      if (!groupsByAuthor.has(key)) {
        groupsByAuthor.set(key, {
          authorId: story.authorId._id,
          authorModel: story.authorModel,
          username: story.authorId.username,
          profilePicture: story.authorId.profilePicture,
          stories: [],
        });
      }

      groupsByAuthor.get(key).stories.push({
        _id: story._id,
        media: story.media,
        caption: story.caption,
        createdAt: story.createdAt,
        viewed: story.viewers.map(String).includes(req.auth.id),
        viewerCount: story.viewers.length,
      });
    }

    const groups = Array.from(groupsByAuthor.values());

    // Own group first, then most-recently-updated author group next.
    groups.sort((a, b) => {
      const aIsSelf = String(a.authorId) === req.auth.id;
      const bIsSelf = String(b.authorId) === req.auth.id;
      if (aIsSelf && !bIsSelf) return -1;
      if (bIsSelf && !aIsSelf) return 1;

      const aLatest = a.stories[a.stories.length - 1].createdAt;
      const bLatest = b.stories[b.stories.length - 1].createdAt;
      return new Date(bLatest) - new Date(aLatest);
    });

    res.status(200).json(groups);
  } catch (err) {
    console.error("GET /story/feed failed:", err);
    res.status(500).json({ message: "Failed to fetch story feed." });
  }
});

// Mark a single story as viewed by the current user.
router.put("/:id/view", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid story id." });
    }

    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: "Story not found or expired." });

    await story.updateOne({ $addToSet: { viewers: req.auth.id } });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("PUT /story/:id/view failed:", err);
    res.status(500).json({ message: "Failed to mark story as viewed." });
  }
});

// Delete your own story early (before the 24h TTL expiry).
router.delete("/:id", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid story id." });
    }

    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: "Story not found." });

    if (String(story.authorId) !== req.auth.id) {
      return res.status(403).json({ message: "You can only delete your own story." });
    }

    await story.deleteOne();
    res.status(200).json({ message: "Story deleted." });
  } catch (err) {
    console.error("DELETE /story/:id failed:", err);
    res.status(500).json({ message: "Failed to delete story." });
  }
});

module.exports = router;