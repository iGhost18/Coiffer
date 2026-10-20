const mongoose = require("mongoose");
const readline = require("readline");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const KEEP_COLLECTIONS = []; // e.g. ["orders"] to keep those entirely
const DRY_RUN = !process.argv.includes("--run");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

(async () => {
  if (!process.env.MONGO_URL || !ADMIN_EMAIL) {
    console.log("Set MONGO_URL and ADMIN_EMAIL first.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL);
  const db = mongoose.connection.db;
  const names = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."));

  // Find the admin account (in whichever collection holds it)
  const emailRx = new RegExp(`^${esc(ADMIN_EMAIL)}$`, "i");
  const matches = [];
  for (const col of names) {
    const docs = await db
      .collection(col)
      .find({ email: emailRx, isAdmin: true })
      .project({ _id: 1, username: 1 })
      .toArray();
    docs.forEach((d) => matches.push({ col, _id: d._id, username: d.username }));
  }

  if (matches.length !== 1) {
    console.log(`Expected exactly 1 admin account, found ${matches.length}:`, matches);
    console.log("Nothing deleted.");
    return process.exit(1);
  }
  const admin = matches[0];
  console.log(`Database: ${db.databaseName}`);
  console.log(`Admin kept: ${admin.username} (${admin._id}) in "${admin.col}"\n`);

  // Show what would be deleted
  const plan = [];
  for (const col of names) {
    if (KEEP_COLLECTIONS.includes(col)) continue;
    const filter = col === admin.col ? { _id: { $ne: admin._id } } : {};
    const count = await db.collection(col).countDocuments(filter);
    plan.push({ col, filter, count });
    console.log(`${col}: ${count} to delete`);
  }

  if (DRY_RUN) {
    console.log("\nDry run only. Run again with --run to delete.");
    return process.exit(0);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`\nType the database name (${db.databaseName}) to confirm: `, async (ans) => {
    rl.close();
    if (ans.trim() !== db.databaseName) {
      console.log("Name didn't match. Nothing deleted.");
      return process.exit(0);
    }
    for (const { col, filter } of plan) {
      const r = await db.collection(col).deleteMany(filter);
      console.log(`${col}: deleted ${r.deletedCount}`);
    }
    console.log("Done.");
    process.exit(0);
  });
})();