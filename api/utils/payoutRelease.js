const Booking = require("../models/booking");
const Staff = require("../models/staff");
const User = require("../models/user");
const Payment = require("../models/payment");
const Schedule = require("../models/schedule");

const MAX_PAYOUT_ATTEMPTS = 5;

function flwHeaders() {
  return {
    Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

/*
========================================
RELEASE PAYOUT TO STAFF
========================================

Atomically claims the booking (held / disputed / payout_failed ->
releasing) so a customer confirm, a staff confirm, the cron sweep and an
admin retry can never send two transfers for the same booking.

Flutterwave transfers are asynchronous: "success" here means the transfer
was ACCEPTED. The final result arrives via the transfer.completed webhook,
which flips the booking to payout_failed if the bank rejected it.
*/
async function releaseBookingPayout(booking) {
  const prev = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      payoutStatus: { $in: ["held", "disputed", "payout_failed"] },
      status: { $ne: "cancelled" },
    },
    { $set: { payoutStatus: "releasing" }, $inc: { payoutAttempts: 1 } },
    { new: false }
  );

  if (!prev) throw new Error("ALREADY_PROCESSING");

  const previousStatus = prev.payoutStatus;
  const attempt = (prev.payoutAttempts || 0) + 1;

  // Put the booking back after a DEFINITE failure so it can be retried.
  // After too many attempts, park it for manual review instead.
  const revert = async () => {
    const next = attempt >= MAX_PAYOUT_ATTEMPTS ? "payout_failed" : previousStatus;
    await Booking.updateOne(
      { _id: prev._id, payoutStatus: "releasing" },
      { $set: { payoutStatus: next } }
    );
  };

  const staff = await Staff.findById(prev.staffId);
  const bank = staff?.flutterwave?.bankAccount;

  if (!bank?.account_bank || !bank?.account_number) {
    await revert();
    throw new Error("STAFF_PAYOUT_DETAILS_MISSING");
  }

  if (!prev.staffPayoutAmount || prev.staffPayoutAmount <= 0) {
    await revert();
    throw new Error("INVALID_PAYOUT_AMOUNT");
  }

  const transferRef = `RELEASE-${prev._id}-${attempt}`;

  let data;
  let accepted = false;

  try {
    const response = await fetch("https://api.flutterwave.com/v3/transfers", {
      method: "POST",
      headers: flwHeaders(),
      body: JSON.stringify({
        account_bank: bank.account_bank,
        account_number: bank.account_number,
        amount: prev.staffPayoutAmount,
        currency: "NGN",
        reference: transferRef,
        narration: `Payout for booking ${prev._id}`,
      }),
    });

    data = await response.json();
    accepted = response.ok && data.status === "success";
  } catch (networkErr) {
    // UNCERTAIN: the transfer may or may not have gone through.
    // Do NOT auto-retry (could double pay) — park for manual review.
    console.error("Transfer request errored, needs manual review:", prev._id, networkErr);
    await Booking.updateOne(
      { _id: prev._id, payoutStatus: "releasing" },
      { $set: { payoutStatus: "payout_failed", transferReference: transferRef } }
    );
    throw new Error("TRANSFER_UNCERTAIN");
  }

  if (!accepted) {
    console.error("Transfer rejected:", data);
    await revert();
    throw new Error("TRANSFER_FAILED");
  }

  await Booking.updateOne(
    { _id: prev._id },
    {
      $set: {
        payoutStatus: "released",
        status: "completed",
        transferReference: transferRef,
      },
    }
  );

  await Schedule.findOneAndUpdate({ bookingId: prev._id }, { $set: { status: "completed" } });
  await User.findByIdAndUpdate(prev.customerId, { $addToSet: { cuts: prev._id } });
  await Staff.findByIdAndUpdate(prev.staffId, { $addToSet: { cuts: prev._id } });

  return Booking.findById(prev._id);
}

/*
========================================
REFUND CUSTOMER
========================================

Refunds booking.total against the original Flutterwave transaction and
marks the booking cancelled (which also frees the time slot).
*/
async function refundBooking(booking) {
  const prev = await Booking.findOneAndUpdate(
    { _id: booking._id, payoutStatus: { $in: ["held", "disputed"] } },
    { $set: { payoutStatus: "refunding" } },
    { new: false }
  );

  if (!prev) throw new Error("ALREADY_PROCESSING");

  try {
    const payment = await Payment.findById(prev.paymentId);

    if (!payment?.flutterwaveTransactionId) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/${payment.flutterwaveTransactionId}/refund`,
      {
        method: "POST",
        headers: flwHeaders(),
        body: JSON.stringify({ amount: prev.total }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.status !== "success") {
      console.error("Refund failed:", data);
      throw new Error("REFUND_FAILED");
    }
  } catch (err) {
    await Booking.updateOne(
      { _id: prev._id, payoutStatus: "refunding" },
      { $set: { payoutStatus: prev.payoutStatus } }
    );
    throw err;
  }

  await Booking.updateOne(
    { _id: prev._id },
    { $set: { payoutStatus: "refunded", status: "cancelled" } }
  );

  await Schedule.findOneAndUpdate({ bookingId: prev._id }, { $set: { status: "cancelled" } });

  return Booking.findById(prev._id);
}

module.exports = { releaseBookingPayout, refundBooking };