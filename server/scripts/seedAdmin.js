// scripts/seedAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ✅ CHANGE THIS import to match your User model path
import User from "../models/User.js"; // common path: server/models/User.js

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function run() {
  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI / MONGODB_URI env var on Render");
    process.exit(1);
  }

  const email = "admin@concaveftld.com";
  const password = "admin1234"; // change later after login
  const name = "Concave Admin";
  const role = "staff"; // or "admin" if your system supports it
  const department = "Management";

  await mongoose.connect(MONGO_URI);

  const existing = await User.findOne({ email });
  if (existing) {
    console.log("✅ Admin already exists:", email);
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  await User.create({
    name,
    email,
    password: hashed,
    role,
    department,
  });

  console.log("✅ Seeded admin user:");
  console.log({ email, password, role, department });

  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});