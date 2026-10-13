const Booking = require("../models/booking");
const Staff = require("../models/staff");
const User = require("../models/user");
const Payment = require("../models/payment");
const Schedule = require("../models/schedule");

const MAX_PAYOUT_ATTEMPTS = 5;

// NOTE: add "payout_uncertain" and "refund_uncertain" to the payoutStatus
// enum in models/booking.js. Neither is in any claim filter below, so nothing
// re-fires them automatically.

function flwHeaders() {
  return {
    Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

async function releaseBookingPayout(booking, { allowDisputed = false } = {}) {
  const claimable = allowDisputed
    ? ["held", "disputed", "payout_failed"]
    : ["held", "payout_failed"];

  const prev = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      payoutStatus: { $in: claimable },
      status: { $ne: "cancelled" },
    },
    { $set: { payoutStatus: "releasing" }, $inc: { payoutAttempts: 1 } },
    { new: false }
  );

  if (!prev) throw new Error("ALREADY_PROCESSING");

  const previousStatus = prev.payoutStatus;
  const attempt = (prev.payoutAttempts || 0) + 1;

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
      signal: AbortSignal.timeout(20000),
    });

    data = await response.json();
    accepted = response.ok && data.status === "success";
  } catch (networkErr) {
    // UNCERTAIN: the transfer may have gone through. A distinct status keeps
    // it out of the claim filter above, so no cron/admin retry can double pay.
    // The transfer.completed webhook (matched by reference) can still resolve it.
    console.error("Transfer outcome unknown:", prev._id, transferRef, networkErr);
    await Booking.updateOne(
      { _id: prev._id, payoutStatus: "releasing" },
      { $set: { payoutStatus: "payout_uncertain", transferReference: transferRef } }
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

    const claimed = await Payment.findOneAndUpdate(
      { _id: payment._id, refundStatus: { $in: [null, "none", "failed"] } },
      { $set: { refundStatus: "processing" } },
      { new: true }
    );
    if (!claimed) throw new Error("REFUND_ALREADY_STARTED");

    let response;
    let data;
    try {
      response = await fetch(
        `https://api.flutterwave.com/v3/transactions/${payment.flutterwaveTransactionId}/refund`,
        {
          method: "POST",
          headers: flwHeaders(),
          body: JSON.stringify({ amount: prev.total }),
          signal: AbortSignal.timeout(15000),
        }
      );
      data = await response.json();
    } catch (err) {
      console.error("Refund outcome unknown for payment", String(payment._id), err);
      throw new Error("REFUND_OUTCOME_UNKNOWN");
    }

    if (!response.ok || data.status !== "success") {
      console.error("Refund failed:", data);
      await Payment.updateOne({ _id: payment._id }, { $set: { refundStatus: "failed" } });
      throw new Error("REFUND_FAILED");
    }

    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          refundStatus: "refunded",
          flutterwaveRefundId: String(data.data?.id ?? ""),
        },
      }
    );
  } catch (err) {
    // Unknown outcome: park the booking so the UI doesn't offer another refund.
    // Check the Flutterwave dashboard, then resolve manually.
    const next = err.message === "REFUND_OUTCOME_UNKNOWN" ? "refund_uncertain" : prev.payoutStatus;
    await Booking.updateOne(
      { _id: prev._id, payoutStatus: "refunding" },
      { $set: { payoutStatus: next } }
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

async function refundWholePayment(paymentId) {
  const p = await Payment.findById(paymentId);
  if (!p?.flutterwaveTransactionId) throw new Error("PAYMENT_NOT_FOUND");

  const claimed = await Payment.findOneAndUpdate(
    { _id: p._id, refundedAmount: { $in: [0, null] } },
    { $set: { refundedAmount: p.amount } },
    { returnDocument: "after" }
  );
  if (!claimed) throw new Error("REFUND_ALREADY_STARTED");

  let response, data;
  try {
    response = await fetch(
      `https://api.flutterwave.com/v3/transactions/${p.flutterwaveTransactionId}/refund`,
      { method: "POST", headers: flwHeaders(), body: JSON.stringify({ amount: p.amount }), signal: AbortSignal.timeout(15000) }
    );
    data = await response.json();
  } catch (err) {
    console.error("Whole-payment refund outcome unknown:", String(p._id), err);
    throw new Error("REFUND_OUTCOME_UNKNOWN"); // refundedAmount stays set, so nothing retries automatically
  }

  if (!response.ok || data.status !== "success") {
    await Payment.updateOne({ _id: p._id }, { $set: { refundedAmount: 0 } });
    throw new Error("REFUND_FAILED");
  }
  await Payment.updateOne(
    { _id: p._id },
    { $set: { refundStatus: "refunded", flutterwaveRefundId: String(data.data?.id ?? "") } }
  );
}

module.exports = { releaseBookingPayout, refundBooking, refundWholePayment };
