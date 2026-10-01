require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");
const Invite = require("../models/invite");

async function run() {
  await mongoose.connect(process.env.MONGO_URL);

  const email = process.argv[2];
  if (!email) {
    console.log("Usage: node scripts/createInvite.js someone@email.com");
    process.exit(1);
  }

  const token = crypto.randomBytes(20).toString("hex");

  const invite = await Invite.create({
    email,
    token,
    used: false,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
  });

  console.log(`✅ Invite created for ${email}`);
  console.log(`Token: ${token}`);
  console.log(`Register at: http://localhost:3000/staffregister/${token}`);

  await mongoose.disconnect();
}

run();
