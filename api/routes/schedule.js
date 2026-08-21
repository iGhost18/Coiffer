const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const Schedule = require("../models/schedule");

const BOOKING_POPULATE = {
  path: "bookingId",
  select: "services appointmentDate appointmentTime address paymentMethod total contact status",
};

const ORDER_POPULATE = {
  path: "orderId",
  select: "items address paymentMethod total contact status",
};

/*
====================================
GET USER SCHEDULE
====================================
*/

router.get("/user/:userId", authenticate, async (req, res) => {
  try {
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
    console.log(err);
    res.status(500).json(err);
  }
});

/*
====================================
GET STAFF SCHEDULE
====================================
*/

router.get("/staff/:staffId", authenticate, async (req, res) => {
  try {
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
    console.log(err);
    res.status(500).json(err);
  }
});

/*
====================================
COUNT SCHEDULE ITEMS
====================================
*/

router.get("/count/:id", authenticate, async (req, res) => {
  try {
    if (req.auth.id !== String(req.params.id)) return res.status(403).json({ message: "Access denied." });
    const count = await Schedule.countDocuments({
      $or: [{ userId: req.params.id }, { staffId: req.params.id }],
    });

    res.status(200).json({ count });
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

/*
====================================
GET SINGLE ITEM
====================================
*/

router.get("/:id", authenticate, async (req, res) => {
  try {
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
    console.log(err);
    res.status(500).json(err);
  }
});

/*
====================================
UPDATE STATUS
====================================
*/

router.put("/:id/status", authenticate, requireAdmin, async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      { $set: { status: req.body.status } },
      { new: true, runValidators: true }
    );

    res.status(200).json(schedule);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

/*
====================================
DELETE
====================================
*/

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await Schedule.findByIdAndDelete(req.params.id);
    res.status(200).json("Schedule deleted.");
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

module.exports = router;