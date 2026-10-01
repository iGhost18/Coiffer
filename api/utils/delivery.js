const HUB_STATES = ["Lagos"];

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function computeDeliveryWindow(address) {
  const state = String(address?.state || "")
    .trim()
    .toLowerCase();

  const isHub = HUB_STATES.some(
    (hub) => hub.toLowerCase() === state
  );

  const today = startOfDay(new Date());

  // Lagos: 1 day from today
  // Other states: 3 days from today
  const startDays = isHub ? 1 : 3;

  const estimatedDeliveryStart = addDays(today, startDays);

  // Exactly 3 days after the start date
  const estimatedDeliveryEnd = addDays(
    estimatedDeliveryStart,
    3
  );

  return {
    estimatedDeliveryStart,
    estimatedDeliveryEnd,
  };
}

module.exports = {
  computeDeliveryWindow,
};