const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();

const Booking = require("../models/booking");
const Schedule = require("../models/schedule");
const Notification = require("../models/notification");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const User = require("../models/user");
const Staff = require("../models/staff");
const { sendNotification, sendMessage, sendMessageUpdate } = require("../../socket/index");
const Servicedetail = require("../models/servicedetail");


function overlaps(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

function getWeekday(date) {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][new Date(date).getDay()];
}


function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes) {
  let hours = Math.floor(totalMinutes / 60);
  let minutes = totalMinutes % 60;

  const suffix = hours >= 12 ? "PM" : "AM";

  hours %= 12;
  if (hours === 0) hours = 12;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function durationToMinutes(duration) {
  if (duration == null) return 0;
  if (typeof duration === "number") return duration;

  const text = String(duration).toLowerCase();
  const hourMatch = text.match(/(\d+)\s*hour/);
  const minuteMatch = text.match(/(\d+)\s*min/);

  let total = 0;
  if (hourMatch) total += Number(hourMatch[1]) * 60;
  if (minuteMatch) total += Number(minuteMatch[1]);

  return total || Number(duration) || 0;
}

// Parses "08:00 AM" / "8:30 PM" style strings (from TimeSlots on the
// frontend) and applies them to a Date object. `new Date("08:00 AM")`
// doesn't reliably parse in Node, which is what was corrupting the
// appointment date into "Invalid Date" before.
function applyTimeString(date, timeStr) {
  if (!timeStr) return date;

  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(timeStr.trim());
  if (!match) return date;

  let [, hours, minutes, meridiem] = match;
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);

  if (/pm/i.test(meridiem) && hours !== 12) hours += 12;
  if (/am/i.test(meridiem) && hours === 12) hours = 0;

  date.setHours(hours, minutes, 0, 0);
  return date;
}

/*
========================================
GET ALL BOOKINGS (admin dashboard)
========================================
*/
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("customerId", "username profilePicture")
      .populate("staffId", "username profilePicture")
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json(err);
  }
});



router.get("/available-slots", async (req, res) => {

    try {

        const { staffId, serviceId, date } = req.query;

        const staff = await Staff.findById(staffId);

        if (!staff)
            return res.status(404).json({ message: "Staff not found" });

        const service = await Servicedetail.findById(serviceId);

        if (!service)
            return res.status(404).json({ message: "Service not found" });

        const selectedDate = new Date(date);

        const dayName = selectedDate.toLocaleDateString("en-US", {
            weekday: "long",
        });

        const daySchedule = staff.schedule[dayName];

        if (!daySchedule) {
            return res.json([]);
        }

        const duration = durationToMinutes(service.duration);

        const start = timeToMinutes(daySchedule.startTime);
        const end = timeToMinutes(daySchedule.endTime);

        const bookings = await Booking.find({
            staffId,
            appointmentDate: {
                $gte: new Date(date + "T00:00:00"),
                $lte: new Date(date + "T23:59:59"),
            },
            status: {
                $nin: ["cancelled"],
            },
        });

        const slots = [];

        const interval = Number(daySchedule.slotDuration || 15);

        const breakStart = daySchedule.breakStart
            ? timeToMinutes(daySchedule.breakStart)
            : null;

        const breakEnd = daySchedule.breakEnd
            ? timeToMinutes(daySchedule.breakEnd)
            : null;

        const bookingCount = bookings.length;

        const maxBookings = Number(daySchedule.maxBookings) || 9999;
        

        for (let current = 0; current < 1440; current += interval) {

            let available = true;
            let reason = "";

            // outside working hours
            if (
                current < start ||
                current + duration > end
            ) {
                available = false;
                reason = "closed";
            }

            // break
            if (
                available &&
                breakStart !== null &&
                current < breakEnd &&
                current + duration > breakStart
            ) {
                available = false;
                reason = "break";
            }

            // daily limit
            if (
                available &&
                bookingCount >= maxBookings
            ) {
                available = false;
                reason = "full";
            }

            // overlap existing bookings
            if (available) {

                for (const booking of bookings) {

                    const bookedDate = new Date(booking.appointmentDate);

                    applyTimeString(
                        bookedDate,
                        booking.appointmentTime
                    );

                    const bookedStart =
                        bookedDate.getHours() * 60 +
                        bookedDate.getMinutes();

                    const bookedDuration = booking.services.reduce(
                        (total, service) =>
                            total +
                            durationToMinutes(service.duration),
                        0
                    );

                    const bookedEnd =
                        bookedStart +
                        bookedDuration;

                    const overlap =
                        current < bookedEnd &&
                        current + duration > bookedStart;

                    if (overlap) {
                        available = false;
                        reason = "booked";
                        break;
                    }
                }
            }

            slots.push({
                time: minutesToTime(current),
                available,
                reason,
            });

        }

        res.json(slots);

    } catch (err) {

        console.log(err);

        res.status(500).json(err);

    }

});

/*
========================================
CREATE BOOKING
========================================
*/
router.post("/", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "User") return res.status(403).json({ message: "Only customers can create bookings." });
    req.body.customerId = req.auth.id;
  
    // Validate booking before saving

    const staff = await Staff.findById(req.body.staffId);

    if (!staff) {
      return res.status(404).json({
        message: "Staff not found.",
      });
    }

    const bookingDate = new Date(req.body.appointmentDate);

    const dayName = bookingDate.toLocaleDateString("en-US", {
      weekday: "long",
    });

    const daySchedule = staff.schedule[dayName];

    if (!daySchedule) {
      return res.json([]);
    }

    const requestedTime = timeToMinutes(
      applyTimeString(
        new Date(),
        req.body.appointmentTime
      ).toTimeString().slice(0,5)
    );

    const start = timeToMinutes(daySchedule.startTime);
    const end = timeToMinutes(daySchedule.endTime);

        // Don't trust duration from the cart/client — look up the authoritative
      // value on each service's Servicedetail doc and sum those instead. This
      // also protects against stale cart snapshots if a service's duration
      // changes after it was added to someone's cart.
      const serviceIds = req.body.services.map(
        (s) => s.itemId || s.serviceId || s._id
      );

      const serviceDetails = await Servicedetail.find({
        _id: { $in: serviceIds },
      });

      if (serviceDetails.length !== req.body.services.length) {
        return res.status(400).json({
          message: "One or more services could not be found.",
        });
      }

      const detailById = new Map(
        serviceDetails.map((d) => [d._id.toString(), d])
      );

      // Overwrite each service's duration with the authoritative string before
      // it's saved on the booking, so later overlap checks (which read
      // existing.services[].duration back off the saved booking) stay correct too.
      req.body.services = req.body.services.map((service) => {
        const key = (service.itemId || service.serviceId || service._id).toString();
        const detail = detailById.get(key);
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

      // Never trust the client for the booking total. Recalculate it from
      // the authoritative service prices stored in MongoDB.
      req.body.total = req.body.services.reduce(
        (sum, service) => sum + service.price * service.quantity,
        0
      );

      req.body.status = "pending";
      req.body.isReadByStaff = false;
      req.body.isReadByUser = false;

      const totalDuration = req.body.services.reduce(
        (sum, service) => sum + durationToMinutes(service.duration),
        0
      );

    if (
      requestedTime < start ||
      requestedTime + totalDuration > end
    ) {
      return res.status(400).json({
        message: "Selected time is outside working hours.",
      });
    }

    const bookings = await Booking.find({
      staffId: req.body.staffId,
      appointmentDate: {
        $gte: new Date(
          bookingDate.toISOString().split("T")[0] + "T00:00:00"
        ),
        $lte: new Date(
          bookingDate.toISOString().split("T")[0] + "T23:59:59"
        ),
      },
      status: {
        $nin: ["cancelled"],
      },
    });

    if (
      bookings.length >= Number(daySchedule.maxBookings)
    ) {
      return res.status(400).json({
        message: "Maximum bookings reached for this day.",
      });
    }

    for (const existing of bookings) {

      const existingDate = new Date(existing.appointmentDate);

      applyTimeString(
        existingDate,
        existing.appointmentTime
      );

      const bookedStart =
        existingDate.getHours() * 60 +
        existingDate.getMinutes();

      const bookedDuration =
        existing.services.reduce(
          (sum, service) =>
            sum + durationToMinutes(service.duration),
          0
        );

      const bookedEnd =
        bookedStart + bookedDuration;

      if (
        requestedTime < bookedEnd &&
        requestedTime + totalDuration > bookedStart
      ) {
        return res.status(409).json({
          message: "This time slot has just been booked.",
        });
      }
    }
    const booking = new Booking(req.body);
    const savedBooking = await booking.save();

    // Combine appointment date & time
    const appointmentDate = new Date(savedBooking.appointmentDate);
    applyTimeString(appointmentDate, savedBooking.appointmentTime);

    const scheduleTitle = savedBooking.services.map((s) => s.name).join(", ");

    // Create Schedule — stays "pending" until staff actually accepts,
    // instead of the previous hardcoded "confirmed".
    const schedule = new Schedule({
      type: "appointment",
      bookingId: savedBooking._id,
      userId: savedBooking.customerId,
      staffId: savedBooking.staffId,
      title: scheduleTitle,
      subtitle: savedBooking.paymentMethod,
      date: appointmentDate,
      status: "pending",
      amount: savedBooking.total,
    });

    await schedule.save();

    const sender = await User.findById(savedBooking.customerId);
    const receiver = await Staff.findById(savedBooking.staffId);


    if (sender && receiver) {
      // Find or create the conversation between this customer and staff
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
        select: "services appointmentDate appointmentTime address paymentMethod total contact status customerId staffId",
        populate: [
          { path: "customerId", select: "username profilePicture" },
          { path: "staffId", select: "username profilePicture location workType" },
        ],
      });

      // Push the booking card live into the staff's Messenger —
      // no refresh needed to see it appear.
      sendMessage(receiver._id.toString(), populatedBookingMessage);

      // Bell notification (existing behavior, now points at the messenger)
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

    res.status(201).json(savedBooking);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

/*
========================================
USER BOOKINGS
========================================
*/
router.get("/user/:userId", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "User" || req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
    const bookings = await Booking.find({ customerId: req.params.userId })
      .populate("staffId", "username profilePicture")
      .sort({ appointmentDate: 1 });

    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json(err);
  }
});

/*
========================================
STAFF BOOKINGS
========================================
*/
router.get("/staff/:staffId", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "Staff" || req.auth.id !== String(req.params.staffId)) return res.status(403).json({ message: "Access denied." });
    const bookings = await Booking.find({ staffId: req.params.staffId })
      .populate("customerId", "username profilePicture")
      .sort({ appointmentDate: 1 });

    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json(err);
  }
});

/*
========================================
UPDATE BOOKING STATUS (accept / decline / complete)
========================================
*/
router.put("/:id/status", authenticate, async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Booking not found." });
    const allowed = req.auth.isAdmin ||
      (req.auth.type === "User" && String(existing.customerId) === req.auth.id) ||
      (req.auth.type === "Staff" && String(existing.staffId) === req.auth.id);
    if (!allowed) return res.status(403).json({ message: "Access denied." });
    const requestedStatus = String(req.body.status || "").toLowerCase();
    const allowedStatuses = ["pending", "confirmed", "completed", "cancelled"];
    if (!allowedStatuses.includes(requestedStatus)) return res.status(400).json({ message: "Invalid booking status." });
    if (req.auth.type === "User" && !["pending", "cancelled"].includes(requestedStatus)) {
      return res.status(403).json({ message: "Customers can only cancel their bookings." });
    }
    if (req.auth.type === "Staff" && !["confirmed", "completed", "cancelled"].includes(requestedStatus)) {
      return res.status(403).json({ message: "Invalid staff booking status." });
    }
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { status: requestedStatus } },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    // Keep schedule status in sync
    await Schedule.findOneAndUpdate(
      { bookingId: booking._id },
      { $set: { status: requestedStatus } }
    );

    // Only "completed" counts toward the customer's "Appointments" stat
    // and the staff's "Appointments Done" stat — not pending/confirmed/cancelled.
    // $addToSet avoids double-counting if this ever fires twice.
    if (req.body.status === "completed") {
      await User.findByIdAndUpdate(booking.customerId, {
        $addToSet: { cuts: booking._id },
      });

      await Staff.findByIdAndUpdate(booking.staffId, {
        $addToSet: { cuts: booking._id },
      });
    }



    // Keep the booking card message in the chat in sync, so it re-renders
    // as accepted/declined instead of staying stuck on "pending"
    const updatedMessage = await Message.findOneAndUpdate(
      { bookingId: booking._id, type: "booking" },
      { $set: { status: requestedStatus } },
      { new: true }
    );

    // Push the status flip live to both sides of the conversation, so
    // neither the customer nor the staff member needs to refresh to see
    // the card update.
    if (updatedMessage) {
      const statusUpdate = {
        messageId: updatedMessage._id,
        conversationId: updatedMessage.conversationId,
        status: req.body.status,
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
      text: `Your appointment has been ${req.body.status}.`,
      link: "/schedule",
    });

    const populatedNotification = await Notification.findById(notification._id).populate(
      "senderId",
      "username profilePicture"
    );

    sendNotification(booking.customerId.toString(), populatedNotification);

    res.status(200).json(booking);
  } catch (err) {
    console.error("PUT /booking/:id/status failed:", err);
    res.status(500).json({ message: "Failed to update booking status." });
  }
});

/*
========================================
DELETE BOOKING
========================================
*/
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Booking not found." });
    const allowed = req.auth.isAdmin ||
      (req.auth.type === "User" && String(existing.customerId) === req.auth.id) ||
      (req.auth.type === "Staff" && String(existing.staffId) === req.auth.id);
    if (!allowed) return res.status(403).json({ message: "Access denied." });
    await Booking.findByIdAndDelete(req.params.id);
    await Schedule.findOneAndDelete({ bookingId: req.params.id });
    res.status(200).json("Booking deleted.");
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;