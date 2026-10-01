const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const mongoose = require("mongoose");
const Schedule = require("../models/schedule");
const User = require("../models/user");
const Staff = require("../models/staff");

const BOOKING_POPULATE = {
  path: "bookingId",
  select: "services appointmentDate appointmentTime address paymentMethod total contact status",
};

const ORDER_POPULATE = {
  path: "orderId",
  select: "items address paymentMethod total contact status deliveryStatus estimatedDeliveryStart estimatedDeliveryEnd shippedAt outForDeliveryAt deliveredAt",
};

// Matches the vocabulary documented in order.js's ORDER_TO_SCHEDULE_STATUS
// comment — kept here explicitly so a bad value gets a clear 400 instead of
// relying solely on Mongoose's runValidators to catch it.
const SCHEDULE_STATUSES = ["pending", "confirmed", "processing", "completed", "delivered", "cancelled"];

/*
====================================
GET USER SCHEDULE
====================================
*/

router.get("/user/:userId", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }
    if (req.auth.type !== "User" || req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });

    const schedules = await Schedule.find({
      userId: req.params.userId,
    })
      .populate("staffId", "username profilePicture name location workType")
      .populate(BOOKING_POPULATE)
      .populate(ORDER_POPULATE)
      .sort({ date: 1 });

    res.status(200).json(schedules);
  } catch (err) {
    console.error("GET /schedule/user/:userId failed:", err);
    res.status(500).json({ message: "Failed to fetch schedule." });
  }
});

/*
====================================
GET STAFF SCHEDULE
====================================
*/

router.get("/staff/:staffId", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.staffId)) {
      return res.status(400).json({ message: "Invalid staff id." });
    }
    if (req.auth.type !== "Staff" || req.auth.id !== String(req.params.staffId)) return res.status(403).json({ message: "Access denied." });

    const schedules = await Schedule.find({
      staffId: req.params.staffId,
    })
      .populate("userId", "username profilePicture name")
      .populate(BOOKING_POPULATE)
      .populate(ORDER_POPULATE)
      .sort({ date: 1 });

    res.status(200).json(schedules);
  } catch (err) {
    console.error("GET /schedule/staff/:staffId failed:", err);
    res.status(500).json({ message: "Failed to fetch schedule." });
  }
});

/*
====================================
MARK SCHEDULE AS VIEWED
====================================
*/
router.put("/mark-viewed/:id", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    if (req.auth.id !== String(req.params.id)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const Model = req.auth.type === "Staff" ? Staff : User;
    await Model.findByIdAndUpdate(req.params.id, { lastScheduleView: new Date() });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("PUT /schedule/mark-viewed/:id failed:", err);
    res.status(500).json({ message: "Failed to update view time." });
  }
});

/*
====================================
COUNT SCHEDULE ITEMS (new since last view)
====================================
*/
router.get("/count/:id", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid id." });
    }
    if (req.auth.id !== String(req.params.id)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const Model = req.auth.type === "Staff" ? Staff : User;
    const person = await Model.findById(req.params.id).select("lastScheduleView");
    const since = person?.lastScheduleView || new Date(0);

    const count = await Schedule.countDocuments({
      $or: [{ userId: req.params.id }, { staffId: req.params.id }],
      createdAt: { $gt: since }, // requires timestamps: true on Schedule model
    });

    res.status(200).json({ count });
  } catch (err) {
    console.error("GET /schedule/count/:id failed:", err);
    res.status(500).json({ message: "Failed to count schedule items." });
  }
});

/*
====================================
GET SINGLE ITEM
====================================
*/

router.get("/:id", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json("Invalid schedule id");
    }

    const schedule = await Schedule.findById(req.params.id)
      .populate("userId", "username profilePicture")
      .populate("staffId", "username profilePicture location workType")
      .populate(BOOKING_POPULATE)
      .populate(ORDER_POPULATE);

    if (!schedule) {
      return res.status(404).json("Schedule not found.");
    }
    if (!req.auth.isAdmin && String(schedule.userId?._id || schedule.userId) !== req.auth.id && String(schedule.staffId?._id || schedule.staffId) !== req.auth.id) {
      return res.status(403).json({ message: "Access denied." });
    }

    res.status(200).json(schedule);
  } catch (err) {
    console.error("GET /schedule/:id failed:", err);
    res.status(500).json({ message: "Failed to fetch schedule item." });
  }
});

/*
====================================
UPDATE STATUS
====================================
*/

router.put("/:id/status", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid schedule id." });
    }

    const requestedStatus = String(req.body.status || "").toLowerCase();

    if (!SCHEDULE_STATUSES.includes(requestedStatus)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${SCHEDULE_STATUSES.join(", ")}.`,
      });
    }

    const schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      { $set: { status: requestedStatus } },
      { new: true, runValidators: true }
    );

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found." });
    }

    res.status(200).json(schedule);
  } catch (err) {
    console.error("PUT /schedule/:id/status failed:", err);
    res.status(500).json({ message: "Failed to update schedule status." });
  }
});

/*
====================================
DELETE
====================================
*/

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid schedule id." });
    }

    const deleted = await Schedule.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json("Schedule not found.");
    }

    res.status(200).json("Schedule deleted.");
  } catch (err) {
    console.error("DELETE /schedule/:id failed:", err);
    res.status(500).json({ message: "Failed to delete schedule." });
  }
});

module.exports = router;