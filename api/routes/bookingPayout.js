const express = require("express");
const router = express.Router();

const Booking = require("../models/booking");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { releaseBookingPayout, refundBooking } = require("../utils/payoutRelease");

function getRole(req, booking) {
  if (req.auth.type === "User" && String(booking.customerId) === String(req.auth.id)) return "customer";
  if (req.auth.type === "Staff" && String(booking.staffId) === String(req.auth.id)) return "staff";
  return null;
}

/*
POST /api/booking-payout/:id/confirm-complete
Either the customer or the staff member confirms the job is done.
When BOTH have confirmed, the payout is released.
*/
router.post("/:id/confirm-complete", authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    const role = getRole(req, booking);
    if (!role) return res.status(403).json({ message: "Access denied." });

    if (booking.payoutStatus !== "held") {
      return res.status(400).json({ message: "This booking is no longer awaiting confirmation." });
    }

    const field = role === "customer" ? "customerConfirmedAt" : "staffConfirmedAt";

    // Atomic: only sets the field if it isn't already set.
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, payoutStatus: "held", [field]: null },
      { $set: { [field]: new Date() } },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ message: "You already confirmed this booking." });
    }

    if (!(updated.customerConfirmedAt && updated.staffConfirmedAt)) {
      return res.status(200).json({
        success: true,
        booking: updated,
        message: `Confirmed. Waiting on the ${role === "customer" ? "staff member" : "customer"}.`,
      });
    }

    try {
      const released = await releaseBookingPayout(updated);
      return res.status(200).json({ success: true, booking: released });
    } catch (err) {
      // Both confirmations are saved; the sweep job retries the payout.
      console.error("Release after confirm failed:", err.message);
      return res.status(200).json({
        success: true,
        booking: updated,
        message: "Both confirmed. Payout is being processed.",
      });
    }
  } catch (error) {
    console.error("confirm-complete failed:", error);
    return res.status(500).json({ message: "Confirmation failed." });
  }
});

/*
POST /api/booking-payout/:id/dispute
Either side can dispute while funds are still held.
*/
router.post("/:id/dispute", authenticate, async (req, res) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "A reason is required." });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    if (!getRole(req, booking)) return res.status(403).json({ message: "Access denied." });

    // Atomic flip so it can't race with the auto-release sweep.
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, payoutStatus: "held" },
      {
        $set: {
          payoutStatus: "disputed",
          dispute: {
            raisedBy: req.auth.id,
            raisedByModel: req.auth.type,
            reason,
            raisedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ message: "This booking can no longer be disputed." });
    }

    // TODO: notify admin (email/push). A disputed booking with money on hold
    // should never sit unnoticed.

    return res.status(200).json({ success: true, booking: updated });
  } catch (error) {
    console.error("dispute failed:", error);
    return res.status(500).json({ message: "Failed to raise dispute." });
  }
});

/* GET /api/booking-payout/admin/disputes — bookings needing admin attention */
router.get("/admin/disputes", authenticate, requireAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find({
      payoutStatus: { $in: ["disputed", "payout_failed"] },
    })
      .populate("customerId", "username profilePicture")
      .populate("staffId", "username profilePicture")
      .sort({ "dispute.raisedAt": 1 });

    return res.status(200).json({ bookings });
  } catch (error) {
    console.error("admin disputes failed:", error);
    return res.status(500).json({ message: "Failed to load disputes." });
  }
});

/* POST /api/booking-payout/admin/:id/resolve   body: { decision: "release" | "refund", note } */
router.post("/admin/:id/resolve", authenticate, requireAdmin, async (req, res) => {
  try {
    const { decision, note } = req.body;

    if (!["release", "refund"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be 'release' or 'refund'." });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    if (booking.payoutStatus !== "disputed") {
      return res.status(400).json({ message: "This booking is not currently disputed." });
    }

    let result;
    try {
      result =
        decision === "release"
          ? await releaseBookingPayout(booking)
          : await refundBooking(booking);
    } catch (err) {
      console.error("resolve failed:", err.message);
      return res.status(502).json({ message: `Could not ${decision}: ${err.message}` });
    }

    await Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          "dispute.resolvedBy": req.auth.id,
          "dispute.resolution": decision === "release" ? "released" : "refunded",
          "dispute.resolvedAt": new Date(),
          "dispute.adminNote": note || null,
        },
      }
    );

    return res.status(200).json({ success: true, booking: await Booking.findById(result._id) });
  } catch (error) {
    console.error("resolve failed:", error);
    return res.status(500).json({ message: "Resolution failed." });
  }
});

/*
POST /api/booking-payout/admin/:id/retry-payout
For bookings parked in payout_failed. CHECK THE FLUTTERWAVE DASHBOARD FIRST
that the earlier transfer really did not go through, to avoid paying twice.
*/
router.post("/admin/:id/retry-payout", authenticate, requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    if (booking.payoutStatus !== "payout_failed") {
      return res.status(400).json({ message: "This booking is not in payout_failed state." });
    }

    // Attempts are NOT reset: each attempt gets a fresh transfer reference
    // (RELEASE-<id>-<attempt>), and reusing one would be rejected as a duplicate.
    const released = await releaseBookingPayout(booking);
    return res.status(200).json({ success: true, booking: released });
  } catch (error) {
    console.error("retry-payout failed:", error);
    return res.status(502).json({ message: `Retry failed: ${error.message}` });
  }
});

module.exports = router;