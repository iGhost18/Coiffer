const mongoose = require("mongoose");

const CartItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
    },
    itemType: {
      type: String,
      enum: ["service", "product"],
      required: true,
    },
    name: String,
    img: String,
    price: Number,
    quantity: {
      type: Number,
      default: 1,
    },
    duration: Number,
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },
  },
  { _id: false }
);

const CartSchema = new mongoose.Schema(
  {
    ownerId: {
      type: String,
      required: true,
    },
    ownerType: {
      type: String,
      enum: ["user", "staff"],
      required: true,
    },
    items: [CartItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", CartSchema);