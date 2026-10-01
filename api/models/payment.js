const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    txRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    flutterwaveTransactionId: {
      type: String,
      default: null,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "NGN",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "successful",
        "failed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },

    paymentMethod: {
      type: String,
      default: "flutterwave",
    },

    // The exact items/customer data used to create
    // the payment. This protects us from relying on
    // modified frontend data after payment.
    checkoutData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    serviceTotal: {
      type: Number,
      default: 0,
    },

    productTotal: {
      type: Number,
      default: 0,
    },

    platformCommission: {
      type: Number,
      default: 0,
    },

    staffPayouts: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    bookingIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Payment", PaymentSchema);