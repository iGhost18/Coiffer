const router = require("express").Router();
const Staff = require("../models/staff");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const Invite = require("../models/invite");
const geocodeAddress = require("../utils/geocode");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


// ─────────────────────────────────────────
//  STAFF REGISTER
// ─────────────────────────────────────────
router.post("/staff/register", async (req, res) => {
  try {
      const {
        token,
        username,
        email,
        password,
        firstName,
        lastName,
        phone,
        bio,
        roles,
        experience,
        workType,
        location,
        specialties,
        workDays,
        profilePicture,
        startTime,
        endTime,
        slotDuration,
        maxBookings
      } = req.body;

    if (!token || !username || !email || !password) {
      return res.status(400).json("All required fields must be filled.");
    }

    if (String(password).length < 8) {
      return res.status(400).json("Password must be at least 8 characters.");
    }

    const invite = await Invite.findOne({ token });

    if (!invite) return res.status(404).json("Invalid invite.");
    if (invite.used) return res.status(400).json("Invite already used.");
    if (invite.expiresAt < new Date()) return res.status(400).json("Invite expired.");
    if (invite.email !== email) return res.status(400).json("Email mismatch.");

    const existingStaff = await Staff.findOne({
      $or: [{ email }, { username }],
    });

    if (existingStaff) {
      return res.status(400).json("Staff already exists.");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const fullAddress = [
      location.address,
      location.city,
      location.state,
      location.country || "Nigeria",
    ]
      .filter(Boolean)
      .join(", ");

    const coordinates = await geocodeAddress(fullAddress);

    const newStaff = new Staff({

        username,
        email,
        password: hashedPassword,

        firstName,
        lastName,
        phone,

        desc: bio,

        roles: roles || [],
        experience,

        workType,

        location: {
            address: location.address || "",
            city: location.city || "",
            state: location.state || "",
            country: location.country || "Nigeria",

            coordinates: coordinates || {
                lat: null,
                lng: null
            },
        },

        specialties: specialties || [],
        workDays: workDays || [],
        profilePicture: profilePicture || "",

        schedule: {
          Monday: {},
          Tuesday: {},
          Wednesday: {},
          Thursday: {},
          Friday: {},
          Saturday: {},
          Sunday: {},
        },
    });

    const savedStaff = await newStaff.save();

    invite.used = true;
    await invite.save();

    const { password: _staffPassword, ...safeStaff } = savedStaff.toObject();
    return res.status(201).json({
      message: "Staff registered successfully",
      staff: safeStaff,
    });

  } catch (err) {
    res.status(500).json("Server error");
  }
});



// USER REGISTER

router.post("/register", async(req,res)=>{

    try{
        if (!req.body.username || !req.body.email || !req.body.password) {
            return res.status(400).json("Username, email and password are required.");
        }
        if (String(req.body.password).length < 8) {
            return res.status(400).json("Password must be at least 8 characters.");
        }

        const salt = await bcrypt.genSalt(10);

        const hashedPassword = await bcrypt.hash(
            req.body.password,
            salt
        );

        const newUser = new User({
          username: req.body.username,
          email: req.body.email,
          phone: req.body.phone,
          password: hashedPassword,
          city: req.body.city,
          state: req.body.state,
          country: req.body.country,
        });

        const user = await newUser.save();
        const { password: _userPassword, ...safeUser } = user.toObject();

        res.status(201).json(safeUser);

    }catch(err){
        res.status(500).json(err);
    }

});



// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const user = await User.findOne({
      $or: [
        { email: new RegExp(`^${escapeRegex(identifier)}$`, "i") },
        { username: new RegExp(`^${escapeRegex(identifier)}$`, "i") },
        { phone: identifier },
      ],
    });

    if (!user) {
      return res.status(404).json("User not found");
    }

    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(400).json("Wrong password");
    }

    const accessToken = jwt.sign(
      { id: user._id.toString(), type: "User", isAdmin: false },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const { password: pw, ...others } = user._doc;

    res.status(200).json({ ...others, accessToken });

  } catch (err) {
    res.status(500).json(err);
  }
});


// ─────────────────────────────────────────
// STAFF LOGIN
// ─────────────────────────────────────────
router.post("/staff/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const staff = await Staff.findOne({
      $or: [
        { email: new RegExp(`^${escapeRegex(identifier)}$`, "i") },
        { username: new RegExp(`^${escapeRegex(identifier)}$`, "i") },
        { phone: identifier },
      ],
    });


    if (!staff) {
      return res.status(404).json("Staff not found.");
    }

    const validPassword = await bcrypt.compare(
      password,
      staff.password
    );

    if (!validPassword) {
      return res.status(400).json("Wrong password.");
    }

    const accessToken = jwt.sign(
      {
        id: staff._id.toString(),
        type: "Staff",
        isAdmin: staff.isAdmin === true,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const { password: pw, ...others } = staff._doc;

    res.status(200).json({
      ...others,
      accessToken,
    });

  } catch (err) {

    res.status(500).json({
      message: err.message,
    });
  }
});


// ─────────────────────────────────────────
//  USER FORGOT / RESET PASSWORD
// ─────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });

    // Same response whether or not the user exists — avoids leaking which emails are registered
    if (!user) {
      return res.status(200).json("If that email exists, a reset link has been sent.");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your password",
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p><p>If you didn't request this, you can ignore this email.</p>`,
    });

    res.status(200).json("If that email exists, a reset link has been sent.");
  } catch (err) {

    res.status(500).json("Server error");
  }
});

router.post("/reset-password/:token", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json("Password must be at least 8 characters.");
    }
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json("Invalid or expired reset link.");

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json("Password has been reset successfully.");
  } catch (err) {
    res.status(500).json("Server error");
  }
});

// ─────────────────────────────────────────
//  STAFF FORGOT / RESET PASSWORD
// ─────────────────────────────────────────
router.post("/staff/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const staff = await Staff.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });

    if (!staff) {
      return res.status(200).json("If that email exists, a reset link has been sent.");
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    staff.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    staff.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await staff.save();

    const resetUrl = `${process.env.CLIENT_URL}/staff/reset-password/${resetToken}`;

    await sendEmail({
      to: staff.email,
      subject: "Reset your password",
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p><p>If you didn't request this, you can ignore this email.</p>`,
    });

    res.status(200).json("If that email exists, a reset link has been sent.");
  } catch (err) {
    res.status(500).json("Server error");
  }
});

router.post("/staff/reset-password/:token", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json("Password must be at least 8 characters.");
    }
    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const staff = await Staff.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!staff) return res.status(400).json("Invalid or expired reset link.");

    const salt = await bcrypt.genSalt(10);
    staff.password = await bcrypt.hash(password, salt);
    staff.resetPasswordToken = undefined;
    staff.resetPasswordExpires = undefined;
    await staff.save();

    res.status(200).json("Password has been reset successfully.");
  } catch (err) {
    res.status(500).json("Server error");
  }
});

// SEARCH USERS + STAFF BY USERNAME (for tagging, mentions, etc.)
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(200).json([]);
    }

    const regex = new RegExp(escapeRegex(q.trim()), "i");

    const [users, staff] = await Promise.all([
      User.find({ username: regex }).select("username profilePicture").limit(5),
      Staff.find({ username: regex }).select("username profilePicture").limit(5),
    ]);

    const results = [
      ...users.map((u) => ({
        id: u._id,
        username: u.username,
        profilePicture: u.profilePicture,
        memberType: "User",
      })),
      ...staff.map((s) => ({
        id: s._id,
        username: s.username,
        profilePicture: s.profilePicture,
        memberType: "Staff",
      })),
    ];

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json(err);
  }
});


module.exports = router;