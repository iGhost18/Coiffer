const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    contact: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },

    items: [
      {
        itemId: { type: String, required: true },
        name: String,
        price: Number,
        quantity: { type: Number, default: 1 },
        img: String,
      },
    ],

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

    status: {
      type: String,
      enum: ["pending", "fulfilled", "cancelled"],
      default: "pending",
    },
    estimatedDeliveryStart: {
      type: Date,
    },

    estimatedDeliveryEnd: {
      type: Date,
    },

    deliveryStatus: {
      type: String,
      enum: [
        "processing",
        "shipped",
        "out_for_delivery",
        "delivered",
      ],
      default: "processing",
    },

    shippedAt: {
      type: Date,
      default: null,
    },

    outForDeliveryAt: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
  },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);