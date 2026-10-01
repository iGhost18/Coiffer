const mongoose = require("mongoose");

const PushSubscriptionSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    ownerModel: { type: String, enum: ["User", "Staff"], required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

PushSubscriptionSchema.index({ ownerId: 1, ownerModel: 1 });

module.exports = mongoose.model("PushSubscription", PushSubscriptionSchema);