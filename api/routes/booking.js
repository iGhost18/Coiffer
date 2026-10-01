const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();

const Booking = require("../models/booking");
const Schedule = require("../models/schedule");
const Notification = require("../models/notification");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const User = require("../models/user");
const Staff = require("../models/staff");
const Servicedetail = require("../models/servicedetail");
const sendEmail = require("../utils/sendEmail");
const {
  bookingConfirmationEmail,
  bookingStatusEmail,
  newBookingNotificationEmail,
} = require("../utils/emailTemplates");
const sendPushToOwner = require("../utils/sendPush");
const { durationToMinutes } = require("../utils/duration");
const { refundBooking } = require("../utils/payoutRelease");

const {
  sendNotification,
  sendMessage,
  sendMessageUpdate,
} = require("../../socket/index");

/*
========================================================
HELPERS
========================================================
*/

// HH:mm -> minutes from midnight (NaN if invalid)
function timeToMinutes(time) {
  if (!time || typeof time !== "string") return NaN;

  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return NaN;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;

  return hours * 60 + minutes;
}

// minutes from midnight -> HH:mm
function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Weekday from YYYY-MM-DD, built from components to avoid timezone ambiguity.
function getWeekdayFromDateString(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}

// Bookings are stored with appointmentDate at UTC midnight.
function getDayBoundaries(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);

  return {
    dayStart: new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)),
    dayEnd: new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)),
  };
}

// Schedule.date needs a real Date: combine calendar date + HH:mm (UTC).
function combineDateAndTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
}

// Total duration of all services in a booking (quantity respected).
function getBookingDuration(booking) {
  if (!booking.services || !Array.isArray(booking.services)) return 0;

  return booking.services.reduce((total, service) => {
    const duration = durationToMinutes(service.duration);
    const quantity = Math.max(1, Number(service.quantity) || 1);
    return total + duration * quantity;
  }, 0);
}

// Uses appointmentTime directly (no Date conversion => no timezone drift).
function getBookingInterval(booking) {
  const bookedStart = timeToMinutes(booking.appointmentTime);
  const bookedDuration = getBookingDuration(booking);

  return { start: bookedStart, end: bookedStart + bookedDuration };
}

function overlaps(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

// Earliest exact start time that fits, independent of the visual slot grid.
function computeExactNextAvailable(start, end, duration, bookings, maxBookings) {
  if (bookings.length >= maxBookings) return null;

  const intervals = bookings
    .map(getBookingInterval)
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end))
    .sort((a, b) => a.start - b.start);

  let candidate = start;

  for (const interval of intervals) {
    if (candidate + duration <= interval.start) break;
    if (candidate < interval.end) candidate = interval.end;
  }

  if (candidate + duration > end) return null;

  return candidate;
}

function isValidDateString(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/*
Payout states in which a paid booking must NOT be cancelled directly.
(held is handled separately: cancelling a held booking refunds the customer.)
*/
const LOCKED_PAYOUT_STATES = [
  "releasing",
  "released",
  "disputed",
  "refunding",
  "payout_failed",
];

/*
========================================================
GET ALL BOOKINGS (ADMIN)
========================================================
*/

router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("customerId", "username profilePicture")
      .populate("staffId", "username profilePicture")
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);
  } catch (err) {
    console.error("GET /booking failed:", err);
    res.status(500).json({ message: "Failed to fetch bookings." });
  }
});

/*
========================================================
AVAILABLE SLOTS
========================================================

Used by DateAndTime.jsx.
Returns { slots: [{ time, available, reason }], exactNextAvailable }
*/

router.get("/available-slots", async (req, res) => {
  try {
    const { staffId, serviceId, date } = req.query;

    if (!staffId || !serviceId || !date) {
      return res.status(400).json({ message: "staffId, serviceId and date are required." });
    }

    if (!isValidDateString(date)) {
      return res.status(400).json({ message: "Invalid date." });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) return res.status(404).json({ message: "Staff not found." });

    const service = await Servicedetail.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found." });

    const dayName = getWeekdayFromDateString(date);
    const daySchedule = staff.schedule?.[dayName];

    if (!daySchedule) {
      return res.json({ slots: [], exactNextAvailable: null });
    }

    const duration = durationToMinutes(service.duration);

    if (duration <= 0) {
      return res.status(400).json({ message: "Service has an invalid duration." });
    }

    const start = timeToMinutes(daySchedule.startTime);
    const end = timeToMinutes(daySchedule.endTime);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return res.json({ slots: [], exactNextAvailable: null });
    }

    const { dayStart, dayEnd } = getDayBoundaries(date);

    // Cancelled (and therefore refunded) bookings do not block a slot.
    const bookings = await Booking.find({
      staffId,
      appointmentDate: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["cancelled"] },
    });

    const interval = Math.max(1, Number(daySchedule.slotDuration) || 15);

    const rawMax = Number(daySchedule.maxBookings);
    const maxBookings = Number.isFinite(rawMax) && rawMax >= 0 ? rawMax : 9999;

    const bookingCount = bookings.length;
    const slots = [];

    for (let current = 0; current < 1440; current += interval) {
      let available = true;
      let reason = "";

      if (current < start || current + duration > end) {
        available = false;
        reason = "closed";
      }

      if (available && bookingCount >= maxBookings) {
        available = false;
        reason = "full";
      }

      if (available) {
        for (const booking of bookings) {
          const { start: bookedStart, end: bookedEnd } = getBookingInterval(booking);

          if (!Number.isFinite(bookedStart) || !Number.isFinite(bookedEnd)) continue;

          if (overlaps(current, current + duration, bookedStart, bookedEnd)) {
            available = false;
            reason = "booked";
            break;
          }
        }
      }

      slots.push({ time: minutesToTime(current), available, reason });
    }

    const exactMinutes = computeExactNextAvailable(start, end, duration, bookings, maxBookings);

    return res.json({
      slots,
      exactNextAvailable: exactMinutes !== null ? minutesToTime(exactMinutes) : null,
    });
  } catch (err) {
    console.error("GET /booking/available-slots failed:", err);
    return res.status(500).json({ message: "Failed to calculate available slots." });
  }
});

/*
========================================================
CREATE BOOKING (direct, non-escrow path)
========================================================

Only whitelisted fields are copied from the request. Never pass req.body
straight into `new Booking(...)`: it would let a customer set payout
fields (payoutStatus, staffPayoutAmount, autoReleaseAt, ...) themselves.

NOTE: bookings created here are not paid through Flutterwave, so their
payoutStatus stays "none" and no payout is ever triggered for them.
If every booking should be paid online, remove this route.
*/

router.post("/", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "User") {
      return res.status(403).json({ message: "Only customers can create bookings." });
    }

    const body = req.body;

    if (
      !body.staffId ||
      !body.appointmentDate ||
      !body.appointmentTime ||
      !Array.isArray(body.services) ||
      body.services.length === 0
    ) {
      return res.status(400).json({ message: "Staff, date, time and services are required." });
    }

    if (!isValidDateString(body.appointmentDate)) {
      return res.status(400).json({ message: "Invalid appointment date." });
    }

    const requestedTime = timeToMinutes(body.appointmentTime);

    if (!Number.isFinite(requestedTime)) {
      return res.status(400).json({ message: "Invalid appointment time. Use HH:mm." });
    }

    const staff = await Staff.findById(body.staffId);
    if (!staff) return res.status(404).json({ message: "Staff not found." });

    const dayName = getWeekdayFromDateString(body.appointmentDate);
    const daySchedule = staff.schedule?.[dayName];

    if (!daySchedule) {
      return res.status(400).json({ message: "Staff is not available on this day." });
    }

    /*
    AUTHORITATIVE SERVICES — never trust duration/price from the frontend.
    */

    const serviceIds = body.services.map((s) => s.itemId || s.serviceId || s._id);

    const serviceDetails = await Servicedetail.find({ _id: { $in: serviceIds } });

    if (serviceDetails.length !== new Set(serviceIds.map(String)).size) {
      return res.status(400).json({ message: "One or more services could not be found." });
    }

    const detailById = new Map(serviceDetails.map((d) => [d._id.toString(), d]));

    const services = body.services.map((service) => {
      const key = String(service.itemId || service.serviceId || service._id);
      const detail = detailById.get(key);

      if (!detail) throw new Error(`Service ${key} not found`);

      const quantity = Math.max(1, Math.min(20, Number(service.quantity) || 1));

      return {
        serviceDetailId: detail._id,
        name: detail.name,
        price: detail.price,
        quantity,
        duration: detail.duration,
        img: detail.img,
      };
    });

    const total = services.reduce((sum, s) => sum + s.price * s.quantity, 0);

    const totalDuration = getBookingDuration({ services });

    const start = timeToMinutes(daySchedule.startTime);
    const end = timeToMinutes(daySchedule.endTime);

    if (requestedTime < start || requestedTime + totalDuration > end) {
      return res.status(400).json({ message: "Selected time is outside working hours." });
    }

    const { dayStart, dayEnd } = getDayBoundaries(body.appointmentDate);

    // Customer double-booking check
    const customerBookings = await Booking.find({
      customerId: req.auth.id,
      appointmentDate: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["cancelled"] },
    });

    for (const existing of customerBookings) {
      const { start: bookedStart, end: bookedEnd } = getBookingInterval(existing);

      if (overlaps(requestedTime, requestedTime + totalDuration, bookedStart, bookedEnd)) {
        return res.status(409).json({
          message: "You already have an appointment booked at this time.",
        });
      }
    }

    // Staff availability check
    const bookings = await Booking.find({
      staffId: body.staffId,
      appointmentDate: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["cancelled"] },
    });

    const maxBookings = Number(daySchedule.maxBookings) || 9999;

    if (bookings.length >= maxBookings) {
      return res.status(400).json({ message: "Maximum bookings reached for this day." });
    }

    for (const existing of bookings) {
      const { start: bookedStart, end: bookedEnd } = getBookingInterval(existing);

      if (overlaps(requestedTime, requestedTime + totalDuration, bookedStart, bookedEnd)) {
        return res.status(409).json({ message: "This time slot has just been booked." });
      }
    }

    /*
    CREATE BOOKING — explicit whitelist only.
    */

    const savedBooking = await new Booking({
      customerId: req.auth.id,
      staffId: body.staffId,
      contact: body.contact,
      services,
      appointmentDate: body.appointmentDate,
      appointmentTime: body.appointmentTime,
      address: body.address,
      paymentMethod: body.paymentMethod,
      total,
      status: "pending",
      isReadByStaff: false,
      isReadByUser: false,
    }).save();

    try {
      if (savedBooking.contact?.email) {
        const { subject, html, text } = bookingConfirmationEmail({
          customerName: savedBooking.contact.name,
          staffName: staff.displayName || staff.username,
          services: savedBooking.services,
          appointmentDate: body.appointmentDate,
          appointmentTime: savedBooking.appointmentTime,
          total: savedBooking.total,
          reference: savedBooking._id.toString().slice(-8).toUpperCase(),
        });
        await sendEmail({ to: savedBooking.contact.email, subject, html, text });
      }
    } catch (emailErr) {
      console.error("Booking confirmation email failed:", emailErr);
    }

    try {
      if (staff?.email) {
        const { subject, html, text } = newBookingNotificationEmail({
          staffName: staff.displayName || staff.username,
          customerName: savedBooking.contact?.name,
          services: savedBooking.services,
          appointmentDate: body.appointmentDate,
          appointmentTime: savedBooking.appointmentTime,
          total: savedBooking.total,
        });
        await sendEmail({ to: staff.email, subject, html, text });
      }
    } catch (emailErr) {
      console.error("Staff booking notification email failed:", emailErr);
    }

    try {
      await sendPushToOwner(staff._id, "Staff", {
        title: "New booking request",
        body: `${savedBooking.contact?.name || "A customer"} requested an appointment.`,
        url: "/messenger",
      });
    } catch (pushErr) {
      console.error("Push notification failed:", pushErr);
    }

    // Schedule entry
    await new Schedule({
      type: "appointment",
      bookingId: savedBooking._id,
      userId: savedBooking.customerId,
      staffId: savedBooking.staffId,
      title: savedBooking.services.map((s) => s.name).join(", "),
      subtitle: savedBooking.paymentMethod,
      date: combineDateAndTime(body.appointmentDate, savedBooking.appointmentTime),
      status: "pending",
      amount: savedBooking.total,
    }).save();

    // Messaging / notification
    const sender = await User.findById(savedBooking.customerId);
    const receiver = await Staff.findById(savedBooking.staffId);

    if (sender && receiver) {
      let conversation = await Conversation.findOne({
        members: { $all: [sender._id.toString(), receiver._id.toString()] },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          members: [sender._id.toString(), receiver._id.toString()],
        });
      }

      const bookingMessage = await Message.create({
        sender: sender._id.toString(),
        conversationId: conversation._id.toString(),
        type: "booking",
        bookingId: savedBooking._id,
        status: "pending",
        text: `${sender.username} requested an appointment`,
      });

      const populatedBookingMessage = await Message.findById(bookingMessage._id).populate({
        path: "bookingId",
        select:
          "services appointmentDate appointmentTime address paymentMethod total contact status customerId staffId payoutStatus customerConfirmedAt staffConfirmedAt autoReleaseAt",
        populate: [
          { path: "customerId", select: "username profilePicture" },
          { path: "staffId", select: "username profilePicture location workType" },
        ],
      });

      sendMessage(receiver._id.toString(), populatedBookingMessage);

      const notification = await Notification.create({
        senderId: sender._id,
        senderModel: "User",
        receiverId: receiver._id,
        receiverModel: "Staff",
        type: "booking",
        bookingId: savedBooking._id,
        text: `${sender.username} booked an appointment.`,
        link: "/messenger",
      });

      const populatedNotification = await Notification.findById(notification._id).populate(
        "senderId",
        "username profilePicture"
      );

      sendNotification(receiver._id.toString(), populatedNotification);
    }

    return res.status(201).json(savedBooking);
  } catch (err) {
    console.error("POST /booking failed:", err);
    return res.status(500).json({
      message: "Failed to create booking.",
      error: err.message,
    });
  }
});

/*
========================================================
USER BOOKINGS
========================================================
(staffPayoutAmount is hidden from customers so they can't see the commission.)
*/

router.get("/user/:userId", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "User" || req.auth.id !== String(req.params.userId)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const bookings = await Booking.find({ customerId: req.params.userId })
      .select("-staffPayoutAmount")
      .populate("staffId", "username profilePicture")
      .sort({ appointmentDate: 1 });

    return res.status(200).json(bookings);
  } catch (err) {
    console.error("GET /booking/user failed:", err);
    return res.status(500).json({ message: "Failed to fetch user bookings." });
  }
});

/*
========================================================
STAFF BOOKINGS
========================================================
*/

router.get("/staff/:staffId", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "Staff" || req.auth.id !== String(req.params.staffId)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const bookings = await Booking.find({ staffId: req.params.staffId })
      .populate("customerId", "username profilePicture")
      .sort({ appointmentDate: 1 });

    return res.status(200).json(bookings);
  } catch (err) {
    console.error("GET /booking/staff failed:", err);
    return res.status(500).json({ message: "Failed to fetch staff bookings." });
  }
});

/*
========================================================
UPDATE BOOKING STATUS
========================================================

Escrow hooks:
  - Cancelling a paid booking whose funds are still held REFUNDS the customer.
  - Cancelling a booking in any other payout state is blocked.
  - Staff marking a booking "completed" counts as the staff confirmation
    for the payout (the customer's confirmation, or the 24h auto-release,
    still decides when money moves).
*/

router.put("/:id/status", authenticate, async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Booking not found." });
    }

    let isAdmin = false;

    if (req.auth.type === "Staff") {
      const staffDoc = await Staff.findById(req.auth.id).select("isAdmin").lean();
      isAdmin = staffDoc?.isAdmin === true;
    }

    const isOwnerCustomer =
      req.auth.type === "User" && String(existing.customerId) === req.auth.id;
    const isOwnerStaff =
      req.auth.type === "Staff" && String(existing.staffId) === req.auth.id;

    if (!isAdmin && !isOwnerCustomer && !isOwnerStaff) {
      return res.status(403).json({ message: "Access denied." });
    }

    const requestedStatus = String(req.body.status || "").toLowerCase();

    const allowedStatuses = ["pending", "confirmed", "completed", "cancelled"];

    if (!allowedStatuses.includes(requestedStatus)) {
      return res.status(400).json({ message: "Invalid booking status." });
    }

    // Customers may only cancel, and only while the booking is still pending.
    if (req.auth.type === "User") {
      if (requestedStatus !== "cancelled") {
        return res.status(403).json({ message: "Customers can only cancel their bookings." });
      }

      if (existing.status !== "pending") {
        return res.status(403).json({
          message: "This booking has already been accepted and can no longer be cancelled.",
        });
      }
    }

    // Staff can confirm, complete, or cancel.
    if (
      req.auth.type === "Staff" &&
      !["confirmed", "completed", "cancelled"].includes(requestedStatus)
    ) {
      return res.status(403).json({ message: "Invalid staff booking status." });
    }

    /*
    ESCROW: cancellation handling
    */

    if (requestedStatus === "cancelled" && existing.paymentId) {
      if (LOCKED_PAYOUT_STATES.includes(existing.payoutStatus)) {
        return res.status(400).json({
          message:
            "This booking's payment is already being settled and can't be cancelled here. Raise a dispute instead.",
        });
      }

      if (existing.payoutStatus === "held") {
        try {
          await refundBooking(existing); // also sets status "cancelled" + Schedule
        } catch (refundErr) {
          console.error("Refund on cancel failed:", refundErr.message);
          return res.status(502).json({
            message: "Could not refund the payment. Please try again or contact support.",
          });
        }
      }
    }

    /*
    UPDATE
    */

    const update = { status: requestedStatus };

    // Staff marking the job completed = staff confirmation for the payout.
    if (
      requestedStatus === "completed" &&
      isOwnerStaff &&
      existing.payoutStatus === "held" &&
      !existing.staffConfirmedAt
    ) {
      update.staffConfirmedAt = new Date();
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    try {
      if (booking.contact?.email) {
        const receiver = await Staff.findById(booking.staffId).select("displayName username");
        const { subject, html } = bookingStatusEmail({
          customerName: booking.contact.name,
          status: requestedStatus,
          staffName: receiver?.displayName || receiver?.username,
        });
        await sendEmail({ to: booking.contact.email, subject, html });
      }
    } catch (emailErr) {
      console.error("Booking status email failed:", emailErr);
    }

    try {
      await sendPushToOwner(booking.customerId, "User", {
        title: `Appointment ${requestedStatus}`,
        body: `Your appointment has been ${requestedStatus}.`,
        url: "/schedule",
      });
    } catch (pushErr) {
      console.error("Push notification failed:", pushErr);
    }

    await Schedule.findOneAndUpdate(
      { bookingId: booking._id },
      { $set: { status: requestedStatus } }
    );

    if (requestedStatus === "completed") {
      await User.findByIdAndUpdate(booking.customerId, {
        $addToSet: { cuts: booking._id },
      });

      await Staff.findByIdAndUpdate(booking.staffId, {
        $addToSet: { cuts: booking._id },
      });
    }

    const updatedMessage = await Message.findOneAndUpdate(
      { bookingId: booking._id, type: "booking" },
      { $set: { status: requestedStatus } },
      { new: true }
    );

    if (updatedMessage) {
      const statusUpdate = {
        messageId: updatedMessage._id,
        conversationId: updatedMessage.conversationId,
        status: requestedStatus,
      };

      sendMessageUpdate(booking.customerId.toString(), statusUpdate);
      sendMessageUpdate(booking.staffId.toString(), statusUpdate);
    }

    const notification = await Notification.create({
      senderId: booking.staffId,
      senderModel: "Staff",
      receiverId: booking.customerId,
      receiverModel: "User",
      bookingId: booking._id,
      type: "bookingConfirmed",
      text: `Your appointment has been ${requestedStatus}.`,
      link: "/schedule",
    });

    const populatedNotification = await Notification.findById(notification._id).populate(
      "senderId",
      "username profilePicture"
    );

    sendNotification(booking.customerId.toString(), populatedNotification);

    return res.status(200).json(booking);
  } catch (err) {
    console.error("PUT /booking/:id/status failed:", err);
    return res.status(500).json({ message: "Failed to update booking status." });
  }
});

/*
========================================================
DELETE BOOKING
========================================================

Bookings with money still in escrow can't be deleted (except by an
admin), otherwise the payment record would be orphaned.
*/

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({ message: "Booking not found." });
    }

    const allowed =
      req.auth.isAdmin ||
      (req.auth.type === "User" && String(existing.customerId) === req.auth.id) ||
      (req.auth.type === "Staff" && String(existing.staffId) === req.auth.id);

    if (!allowed) {
      return res.status(403).json({ message: "Access denied." });
    }

    const moneyInEscrow = [
      "held",
      "releasing",
      "disputed",
      "refunding",
      "payout_failed",
    ].includes(existing.payoutStatus);

    if (moneyInEscrow && !req.auth.isAdmin) {
      return res.status(400).json({
        message: "This booking has a payment in progress and can't be deleted.",
      });
    }

    await Booking.findByIdAndDelete(req.params.id);
    await Schedule.findOneAndDelete({ bookingId: req.params.id });

    return res.status(200).json("Booking deleted.");
  } catch (err) {
    console.error("DELETE /booking/:id failed:", err);
    return res.status(500).json({ message: "Failed to delete booking." });
  }
});

module.exports = router;