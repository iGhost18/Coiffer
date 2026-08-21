const mongoose = require("mongoose");

const HomepageServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    desc: { type: String, default: "" },
    img: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HomepageService", HomepageServiceSchema);