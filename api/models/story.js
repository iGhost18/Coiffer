const mongoose = require("mongoose");

const StorySchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "authorModel",
    },
    authorModel: {
      type: String,
      required: true,
      enum: ["User", "Staff"],
    },
    media: {
      url: { type: String, required: true },
      type: { type: String, enum: ["image", "video"], required: true },
    },
    caption: {
      type: String,
      default: "",
      maxlength: 300,
    },
    // Userids (string form, matches the pattern used for Post.likes/savedBy)
    // of everyone who has viewed this story.
    viewers: {
      type: [String],
      default: [],
    },
    // TTL field — see the index below. A story simply ceases to exist in
    // the DB 24h after creation; no cron job or cleanup script needed.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

// MongoDB's TTL monitor sweeps expired documents automatically —
// expireAfterSeconds: 0 means "delete exactly at expiresAt", not 0 seconds
// after insert.
StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Story", StorySchema);