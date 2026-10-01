const router = require("express").Router();
const mongoose = require("mongoose");

const Rating = require("../models/rating");
const Booking = require("../models/booking");
const Staff = require("../models/staff");

const { authenticate } = require("../middleware/auth");

// Recompute and persist a staff member's average rating + count.
async function recomputeStaffRating(staffId) {
  const stats = await Rating.aggregate([
    { $match: { staffId: new mongoose.Types.ObjectId(staffId) } },
    {
      $group: {
        _id: "$staffId",
        avg: { $avg: "$score" },
        count: { $sum: 1 },
      },
    },
  ]);

  const { avg = 0, count = 0 } = stats[0] || {};

  await Staff.findByIdAndUpdate(staffId, {
    rating: Math.round(avg * 10) / 10, // one decimal place
    ratingCount: count,
  });
}

// ─────────────────────────────────────────
// SUBMIT OR UPDATE A RATING
// ─────────────────────────────────────────
router.post("/", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "User") {
      return res.status(403).json({
        message: "Only customers can leave a rating.",
      });
    }

    const { staffId, bookingId, score, review } = req.body;

    if (!mongoose.isValidObjectId(staffId) || !mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ message: "Invalid staff or booking id." });
    }

    const numericScore = Number(score);

    if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
      return res.status(400).json({ message: "Score must be an integer from 1 to 5." });
    }

    // Confirm the booking exists, belongs to this user, is with this staff
    // member, and was actually completed — this is what stops someone
    // rating a barber they've never booked.
    const booking = await Booking.findOne({
      _id: bookingId,
      customerId: req.auth.id,
      staffId,
      status: "completed",
    });

    if (!booking) {
      return res.status(403).json({
        message: "You can only rate staff after a completed appointment.",
      });
    }

    const rating = await Rating.findOneAndUpdate(
      { staffId, userId: req.auth.id },
      {
        staffId,
        userId: req.auth.id,
        bookingId,
        score: numericScore,
        review: typeof review === "string" ? review.slice(0, 500) : "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await recomputeStaffRating(staffId);

    return res.status(200).json(rating);
  } catch (err) {
    console.error("POST /rating failed:", err);
    return res.status(500).json({ message: "Failed to submit rating." });
  }
});

// ─────────────────────────────────────────
// GET ALL RATINGS FOR A STAFF MEMBER
// ─────────────────────────────────────────
router.get("/staff/:staffId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.staffId)) {
      return res.status(400).json({ message: "Invalid staff id." });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const ratings = await Rating.find({ staffId: req.params.staffId })
      .populate("userId", "username profilePicture")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json(ratings);
  } catch (err) {
    console.error("GET /rating/staff/:staffId failed:", err);
    res.status(500).json({ message: "Failed to fetch ratings." });
  }
});

// ─────────────────────────────────────────
// GET THE CURRENT USER'S OWN RATING FOR A STAFF MEMBER
// (so the frontend can prefill the star widget if they've already rated)
// ─────────────────────────────────────────
router.get("/mine/:staffId", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "User") {
      return res.status(200).json(null);
    }

    if (!mongoose.isValidObjectId(req.params.staffId)) {
      return res.status(400).json({ message: "Invalid staff id." });
    }

    const rating = await Rating.findOne({
      staffId: req.params.staffId,
      userId: req.auth.id,
    });

    res.status(200).json(rating || null);
  } catch (err) {
    console.error("GET /rating/mine/:staffId failed:", err);
    res.status(500).json({ message: "Failed to fetch your rating." });
  }
});

module.exports = router;