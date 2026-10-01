const Booking = require("../models/booking");
const { releaseBookingPayout, refundBooking } = require("../utils/payoutRelease");

async function runAutoReleaseSweep() {
  const now = new Date();

  /*
  1) Release to staff when:
     - the booking was accepted (confirmed/completed) and the 24h window
       after the appointment has passed with no dispute, OR
     - both sides confirmed but the earlier transfer attempt failed.
  */
  const dueRelease = await Booking.find({
    payoutStatus: "held",
    $or: [
      {
        status: { $in: ["confirmed", "completed"] },
        autoReleaseAt: { $lte: now },
      },
      {
        customerConfirmedAt: { $ne: null },
        staffConfirmedAt: { $ne: null },
      },
    ],
  });

  /*
  2) Refund the customer when staff never accepted the booking (still
     "pending") and the appointment window has long passed.
  */
  const dueRefund = await Booking.find({
    payoutStatus: "held",
    status: "pending",
    autoReleaseAt: { $lte: now },
    $or: [{ customerConfirmedAt: null }, { staffConfirmedAt: null }],
  });

  if (dueRelease.length || dueRefund.length) {
    console.log(
      `Payout sweep: ${dueRelease.length} to release, ${dueRefund.length} to refund.`
    );
  }

  for (const booking of dueRelease) {
    try {
      await releaseBookingPayout(booking);
      console.log(`Released payout for booking ${booking._id}`);
      // TODO: notify staff + customer that the payout was released
    } catch (err) {
      console.error(`Auto-release failed for ${booking._id}:`, err.message);
    }
  }

  for (const booking of dueRefund) {
    try {
      await refundBooking(booking);
      console.log(`Refunded unaccepted booking ${booking._id}`);
      // TODO: notify customer
    } catch (err) {
      console.error(`Auto-refund failed for ${booking._id}:`, err.message);
    }
  }
}

module.exports = { runAutoReleaseSweep };