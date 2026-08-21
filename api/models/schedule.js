const mongoose = require("mongoose");

const ScheduleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["appointment", "order"],
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    title: {
      type: String,
      required: true,
    },

    subtitle: {
      type: String,
      default: "",
    },

    date: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "completed",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },

    amount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Schedule", ScheduleSchema);