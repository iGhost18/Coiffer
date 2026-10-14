const express = require("express");
const router = express.Router();

const Booking = require("../models/booking");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { releaseBookingPayout, refundBooking } = require("../utils/payoutRelease");

const Staff = require("../models/staff");
const User = require("../models/user");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const Notification = require("../models/notification");
const sendEmail = require("../utils/sendEmail");
const { disputeAlertEmail } = require("../utils/emailTemplates");
const { sendMessage, sendNotification } = require("../socket/index");


function getRole(req, booking) {
  if (req.auth.type === "User" && String(booking.customerId) === String(req.auth.id)) return "customer";
  if (req.auth.type === "Staff" && String(booking.staffId) === String(req.auth.id)) return "staff";
  return null;
}

const DISPUTE_CATEGORIES = [
  "expert_no_show",
  "service_not_completed",
  "poor_quality",
  "customer_no_show",
  "other",
];

async function notifyDispute(booking, role) {
  const ref = String(booking._id).slice(-6).toUpperCase();
  const raiserId = String(booking.dispute.raisedBy);
  const raiserType = role === "customer" ? "User" : "Staff";
  const otherId = String(role === "customer" ? booking.staffId : booking.customerId);
  const otherType = role === "customer" ? "Staff" : "User";

  const [raiser, staffDoc, admins] = await Promise.all([
    (role === "customer" ? User : Staff).findById(raiserId).select("username"),
    Staff.findById(booking.staffId).select("username displayName"),
    Staff.find({ isAdmin: true }).select("_id"),
  ]);

  const raiserName = raiser?.username || role;
  const categoryLabel = String(booking.dispute.category || "other").replace(/_/g, " ");
  const messageText = `⚠️ Dispute on booking #${ref} from ${role} @${raiserName} (${categoryLabel}): ${booking.dispute.reason}`;

  const notify = async (receiverId, receiverModel, body, link) => {
    const n = await Notification.create({
      senderId: raiserId,
      senderModel: raiserType,
      receiverId,
      receiverModel,
      type: "booking",
      bookingId: booking._id,
      text: body,
      link,
    });
    const populated = await Notification.findById(n._id).populate("senderId", "username profilePicture");
    sendNotification(String(receiverId), populated);
  };

  // 1) A message in each admin's messenger, plus a notification
  for (const admin of admins) {
    const adminId = String(admin._id);
    if (adminId === raiserId) continue;
    try {
      let conversation = await Conversation.findOne({ members: { $all: [raiserId, adminId] } });
      if (!conversation) conversation = await Conversation.create({ members: [raiserId, adminId] });

      const message = await Message.create({
        sender: raiserId,
        conversationId: conversation._id.toString(),
        text: messageText,
      });

      await Conversation.updateOne({ _id: conversation._id }, { $set: { lastMessageAt: new Date() } });
      
      sendMessage(adminId, message);
      await notify(adminId, "Staff", `Dispute raised on booking #${ref}.`, "/messenger");
    } catch (err) {
      console.error("Dispute: admin message failed:", err);
    }
  }

  // 2) Tell the other side the payment is on hold
  try {
    await notify(
      otherId,
      otherType,
      `A dispute was raised on booking #${ref}. The payment is on hold while our team reviews it.`,
      "/schedule"
    );
  } catch (err) {
    console.error("Dispute: other-party notify failed:", err);
  }

  // 3) Email to the company inbox
  try {
    if (process.env.COMPANY_EMAIL) {
      const { subject, html, text } = disputeAlertEmail({
        reference: ref,
        role,
        raisedBy: raiserName,
        category: categoryLabel,
        reason: booking.dispute.reason,
        customerName: booking.contact?.name || "Customer",
        staffName: staffDoc?.displayName || staffDoc?.username || "Expert",
        total: booking.total,
        dashboardUrl: `${(process.env.CLIENT_URL || "").replace(/\/+$/, "")}/dashboard`,
      });
      await sendEmail({ to: process.env.COMPANY_EMAIL, subject, html, text });
    }
  } catch (err) {
    console.error("Dispute: admin email failed:", err);
  }
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
    const category = DISPUTE_CATEGORIES.includes(req.body.category) ? req.body.category : "other";

    if (reason.length < 10) {
      return res.status(400).json({ message: "Please describe what went wrong (at least 10 characters)." });
    }
    if (reason.length > 1000) {
      return res.status(400).json({ message: "Please keep the description under 1000 characters." });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found." });

    const role = getRole(req, booking);
    if (!role) return res.status(403).json({ message: "Access denied." });

    // Atomic flip so it can't race with the auto-release sweep.
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, payoutStatus: "held" },
      {
        $set: {
          payoutStatus: "disputed",
          dispute: {
            raisedBy: req.auth.id,
            raisedByModel: req.auth.type,
            category,
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

    // The dispute is already saved; a failed alert must not undo it.
    notifyDispute(updated, role).catch((err) => console.error("notifyDispute failed:", err));

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
      payoutStatus: { $in: ["disputed", "payout_failed", "payout_uncertain", "refund_uncertain"] },
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
          ? await releaseBookingPayout(booking, { allowDisputed: true })
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