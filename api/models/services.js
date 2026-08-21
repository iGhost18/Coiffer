const mongoose = require("mongoose");

const ServicesSchema = new mongoose.Schema(
    {
        label: {
            type: String,
            required: true,
            trim: true,
        },
        img: {
            type: String,
            required: true,
        },
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Staff",
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Services", ServicesSchema);

