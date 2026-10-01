const mongoose = require("mongoose");

const RatingSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true }
);

// One rating per user per staff member — resubmitting updates it instead
// of creating a duplicate.
RatingSchema.index({ staffId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Rating", RatingSchema);