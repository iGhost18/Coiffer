require("dotenv").config();
const mongoose = require("mongoose");
const Staff = require("../models/staff");

async function run() {
  await mongoose.connect(process.env.MONGO_URL);

  const email = process.argv[2];
  if (!email) {
    console.log("Usage: node scripts/promoteAdmin.js abidemighost08@gmail.com");
    process.exit(1);
  }

  const staff = await Staff.findOneAndUpdate(
    { email },
    { $set: { isAdmin: true } },
    { new: true }
  );

  if (!staff) {
    console.log("No staff found with that email.");
  } else {
    console.log(`✅ ${staff.username} (${staff.email}) is now an admin.`);
  }

  await mongoose.disconnect();
}

run();