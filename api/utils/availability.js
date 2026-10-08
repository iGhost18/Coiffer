const Booking = require("../models/booking");
const Staff = require("../models/staff");
const { durationToMinutes } = require("./duration");

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function toMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim());
  if (!m) return NaN;
  const h = Number(m[1]), min = Number(m[2]);
  return h > 23 || min > 59 ? NaN : h * 60 + min;
}

// Returns null if the slot is bookable, otherwise a customer-facing reason.
async function checkSlot({ staffId, dateStr, timeStr, durationMinutes }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return "Invalid appointment date.";
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dayStart = new Date(Date.UTC(y, mo - 1, d));
  if (dayStart.getUTCFullYear() !== y || dayStart.getUTCMonth() !== mo - 1 || dayStart.getUTCDate() !== d) {
    return "Invalid appointment date.";
  }
  const dayEnd = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));
  if (dayEnd < new Date()) return "That date has already passed.";
  if (dayStart.getTime() > Date.now() + 120 * 24 * 60 * 60 * 1000) return "That date is too far ahead.";

  const start = toMinutes(timeStr);
  if (!Number.isFinite(start)) return "Invalid appointment time.";
  if (!(durationMinutes > 0)) return "Invalid service duration.";
  if (new Date(dayStart.getTime() + start * 60000) < new Date()) return "That time has already passed.";

  const staff = await Staff.findById(staffId).select("schedule").lean();
  if (!staff) return "Professional not found.";

  const dayName = DAYS[dayStart.getUTCDay()];


  const day = staff.schedule?.[dayName];
  const open = toMinutes(day?.startTime);
  const close = toMinutes(day?.endTime);
  if (!Number.isFinite(open) || !Number.isFinite(close) || start < open || start + durationMinutes > close) {
    return "That time is outside working hours.";
  }

  const existing = await Booking.find({
    staffId,
    appointmentDate: { $gte: dayStart, $lte: dayEnd },
    status: { $ne: "cancelled" },
  }).select("services appointmentTime").lean();

  const max = Number(day.maxBookings);
  if (Number.isFinite(max) && max >= 0 && existing.length >= max) {
    return "This professional is fully booked that day.";
  }

  for (const b of existing) {
    const bs = toMinutes(b.appointmentTime);
    const dur = (b.services || []).reduce(
      (t, s) => t + durationToMinutes(s.duration) * Math.max(1, Number(s.quantity) || 1), 0
    );
    if (Number.isFinite(bs) && start < bs + dur && start + durationMinutes > bs) {
      return "That time was just booked by someone else.";
    }
  }
  return null;
}

module.exports = { checkSlot };