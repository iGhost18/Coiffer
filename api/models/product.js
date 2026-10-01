const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // The discounted/sale price. When set and lower than `price`, the
    // storefront shows `price` struck through next to `discountPrice`.
    // Left null/undefined for products with no active discount.
    discountPrice: {
      type: Number,
      min: 0,
      default: null,
      validate: {
        validator: function (value) {
          if (value == null) return true;
          return value < this.price;
        },
        message: "Discount price must be lower than the regular price.",
      },
    },

    category: {
      type: String,
      trim: true,
      default: "",
    },

    available: {
      type: Boolean,
      default: true,
    },

    image: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);