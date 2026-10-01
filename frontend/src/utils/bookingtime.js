// Same duration-parsing logic as the backend (utils/duration.js), so the
// frontend and backend agree on how long a booking actually takes.
export function durationToMinutes(duration) {
  if (duration == null) return 0;
  if (typeof duration === "number") return Number.isFinite(duration) ? duration : 0;

  const text = String(duration).toLowerCase().trim();
  const hourMatch = text.match(/(\d+)\s*(?:hr|hrs|hour|hours)/);
  const minuteMatch = text.match(/(\d+)\s*(?:min|mins|minute|minutes)/);

  let total = 0;
  if (hourMatch) total += Number(hourMatch[1]) * 60;
  if (minuteMatch) total += Number(minuteMatch[1]);

  if (!hourMatch && !minuteMatch) {
    const number = Number(text);
    if (Number.isFinite(number)) total = number;
  }

  return total || 0;
}

export function getBookingDurationMinutes(booking) {
  if (!booking?.services || !Array.isArray(booking.services)) return 0;
  return booking.services.reduce((sum, s) => {
    const quantity = Math.max(1, Number(s.quantity) || 1);
    return sum + durationToMinutes(s.duration) * quantity;
  }, 0);
}

// Date representing when the appointment ENDS (start time + total service
// duration). appointmentTime is stored as 24-hour "HH:mm".
export function getAppointmentEndDateTime(booking) {
  if (!booking?.appointmentDate || !booking?.appointmentTime) return null;

  const date = new Date(booking.appointmentDate);
  const match = /^(\d{1,2}):(\d{2})$/.exec((booking.appointmentTime || "").trim());

  if (!match) return null;

  date.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
  date.setMinutes(date.getMinutes() + getBookingDurationMinutes(booking));

  return date;
}