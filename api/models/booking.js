const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },

    contact: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },

    services: [
      {
        serviceDetailId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Servicedetail",
        },
        name: String,
        price: Number,
        quantity: { type: Number, default: 1 },
        duration: String,
        img: String,
      },
    ],

    appointmentDate: { type: Date, required: true },
    appointmentTime: { type: String, required: true },

    address: {
      state: String,
      city: String,
      description: String,
    },

    paymentMethod: { type: String, required: true },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    total: { type: Number, required: true },

    // CHANGED: lowercase to match Schedule.status and Message.status —
    // previously this was "Pending"/"Confirmed"/etc while Schedule was
    // created with a hardcoded lowercase "confirmed", so a status update
    // here would silently desync the schedule and dashboard filters.
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },

    isReadByStaff: { type: Boolean, default: false },
    isReadByUser: { type: Boolean, default: false },
    customerConfirmedAt: { type: Date, default: null },
    staffConfirmedAt: { type: Date, default: null },

    payoutStatus: {
      type: String,
      enum: ["none", "held", "releasing", "released", "payout_failed", "disputed", "refunding", "refunded"],
      default: "none",
      index: true,
    },

    payoutAttempts: { type: Number, default: 0 },
    staffPayoutAmount: { type: Number, default: 0 },
    autoReleaseAt: { type: Date, default: null, index: true },
    transferReference: { type: String, default: null, index: true },

    staffPayoutAmount: { type: Number, required: true }, // snapshot at booking creation, from Payment.staffPayouts

    dispute: {
      raisedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
      raisedByModel: { type: String, enum: ["User", "Staff"], default: null },
      reason: { type: String, default: null },
      raisedAt: { type: Date, default: null },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, default: null }, // admin id
      resolution: { type: String, enum: ["released", "refunded"], default: null },
      resolvedAt: { type: Date, default: null },
      adminNote: { type: String, default: null },
    },
    
    autoReleaseAt: { type: Date, default: null, index: true },

    transferReference: { type: String, default: null },
  },
  { timestamps: true }
);

// Prevent the same staff member from receiving two bookings for the exact
// same appointment start time under concurrent requests.
BookingSchema.index(
  { staffId: 1, appointmentDate: 1, appointmentTime: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: "cancelled" } } }
);
BookingSchema.index({ staffId: 1, appointmentDate: 1, status: 1 });
BookingSchema.index({ customerId: 1, appointmentDate: -1 });

module.exports = mongoose.model("Booking", BookingSchema);