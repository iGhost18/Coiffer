/*
Convert a service duration into minutes.

Supported: "30 mins", "45 min", "1 hr", "1 hour", "1 hr 30 mins", 30, "45"
*/
function durationToMinutes(duration) {
  if (duration == null) return 0;

  if (typeof duration === "number") {
    return Number.isFinite(duration) ? duration : 0;
  }

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

module.exports = { durationToMinutes };