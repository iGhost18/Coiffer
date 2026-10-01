const router = require("express").Router();

const Staff = require("../models/staff");
const User = require("../models/user");
const Invite = require("../models/invite");
const RefreshToken = require("../models/refreshToken");

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const sendEmail = require("../utils/sendEmail");
const geocodeAddress = require("../utils/geocode");

const { authenticate, requireAdmin } = require("../middleware/auth");
const validate = require("../middleware/validate");
const rateLimit = require("../middleware/rateLimit");

const {
  registerSchema,
  staffRegisterSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../validation/authSchemas");

const escapeRegex = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_COOKIE_NAME = "refreshToken";

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const issueRefreshToken = async (ownerId, ownerType) => {
  const rawToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await RefreshToken.create({ tokenHash, ownerId, ownerType, expiresAt });

  return { rawToken, expiresAt };
};

const setRefreshCookie = (res, rawToken, expiresAt) => {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/api/auth", // only ever sent to auth endpoints, nowhere else
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
  });
};

const signAccessToken = (id, type) =>
  jwt.sign({ id, type }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts from this IP, please try again after 15 minutes.",
});


// ─────────────────────────────────────────
//  STAFF REGISTER
// ─────────────────────────────────────────
router.post(
  "/staff/register",
  validate(staffRegisterSchema),
  async (req, res) => {
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
        maxBookings,
      } = req.validated.body;

      // Normalize email once, up front, so every downstream check/store uses the same value
      const normalizedEmail = email.toLowerCase().trim();

      // --------------------------------------------------
      // VERIFY INVITATION
      // --------------------------------------------------

      const invite = await Invite.findOne({
        token,
        email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i"),
        used: false,
        expiresAt: { $gt: new Date() },
      });

      if (!invite) {
        return res.status(400).json({
          message: "Invalid or expired invitation.",
        });
      }

      // --------------------------------------------------
      // CHECK FOR EXISTING STAFF
      // --------------------------------------------------

      const existingStaff = await Staff.findOne({
        $or: [
          { email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i") },
          { username },
          { phone },
        ],
      }).lean();

      if (existingStaff) {
        return res.status(409).json({
          message: "An account with those details already exists.",
        });
      }

      // --------------------------------------------------
      // HASH PASSWORD
      // --------------------------------------------------

      const hashedPassword = await bcrypt.hash(password, 12);

      // --------------------------------------------------
      // BUILD ADDRESS
      // --------------------------------------------------

      const fullAddress = [
        location.address,
        location.city,
        location.state,
        location.country || "Nigeria",
      ]
        .filter(Boolean)
        .join(", ");

      // --------------------------------------------------
      // GEOCODE LOCATION
      // --------------------------------------------------

      let coordinates = {
        lat: null,
        lng: null,
      };

      if (fullAddress) {
        const result = await geocodeAddress(fullAddress);

        if (result) {
          coordinates = result;
        }
      }

      // --------------------------------------------------
      // CREATE STAFF
      // --------------------------------------------------

      const newStaff = new Staff({
        username,
        email: normalizedEmail,
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
          coordinates,
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

      // --------------------------------------------------
      // MARK INVITE AS USED
      // --------------------------------------------------

      invite.used = true;
      await invite.save();

      // --------------------------------------------------
      // NEVER RETURN PASSWORD
      // --------------------------------------------------

      const safeStaff = savedStaff.toObject();

      delete safeStaff.password;
      delete safeStaff.resetPasswordToken;
      delete safeStaff.resetPasswordExpires;

      return res.status(201).json({
        message: "Staff registered successfully.",
        staff: safeStaff,
      });

    } catch (err) {
      console.error("Staff registration error:", err);

      // Mongo duplicate-key protection
      if (err.code === 11000) {
        return res.status(409).json({
          message: "An account with those details already exists.",
        });
      }

      return res.status(500).json({
        message: "Unable to complete staff registration.",
      });
    }
  }
);


// USER REGISTER

router.post(
  "/register",
  validate(registerSchema),
  async (req, res) => {
    try {
      const {
        username,
        email,
        password,
        phone,
        firstName,
        lastName,
        city,
        state,
        country,
      } = req.validated.body;

      // Normalize once — this is what fixes the case-sensitivity bug at its source
      const normalizedEmail = email.toLowerCase().trim();

      const existingUser = await User.findOne({
        $or: [
          { email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i") },
          { username },
          ...(phone ? [{ phone }] : []),
        ],
      }).lean();

      if (existingUser) {
        return res.status(409).json({
          message: "An account with those details already exists.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = await User.create({
        username,
        email: normalizedEmail,
        phone: phone || "",
        password: hashedPassword,
        firstName: firstName || "",
        lastName: lastName || "",
        city: city || "",
        state: state || "",
        country: country || "",
      });

      const safeUser = newUser.toObject();

      delete safeUser.password;
      delete safeUser.resetPasswordToken;
      delete safeUser.resetPasswordExpires;

      return res.status(201).json({
        message: "Registration successful.",
        user: safeUser,
      });
    } catch (err) {
      console.error("User registration error:", err);

      return res.status(500).json({
        message: "Unable to complete registration.",
      });
    }
  }
);

// LOGIN
router.post(
  "/login", loginLimiter,
  validate(loginSchema),
  async (req, res) => {
    try {
      const { identifier, password } = req.validated.body;

      const safeIdentifier = identifier.trim();

      // Case-insensitive email match — fixes accounts registered with mixed-case
      // emails being unable to log in with a differently-cased version
      const user = await User.findOne({
        $or: [
          { email: new RegExp(`^${escapeRegex(safeIdentifier)}$`, "i") },
          { username: safeIdentifier },
          { phone: safeIdentifier },
        ],
      });

      if (!user) {
        return res.status(401).json({
          message: "Invalid credentials.",
        });
      }

      const validPassword = await bcrypt.compare(
        password,
        user.password
      );

      if (!validPassword) {
        return res.status(401).json({
          message: "Invalid credentials.",
        });
      }

      // Now issues a refresh token + cookie too, same as staff login,
      // instead of a bare 1h token with no way to renew it
      const accessToken = signAccessToken(user._id.toString(), "User");
      const { rawToken, expiresAt } = await issueRefreshToken(user._id, "User");
      setRefreshCookie(res, rawToken, expiresAt);

      const safeUser = user.toObject();

      delete safeUser.password;
      delete safeUser.resetPasswordToken;
      delete safeUser.resetPasswordExpires;

      return res.status(200).json({
        user: safeUser,
        accessToken,
      });
    } catch (err) {
      console.error("Login error:", err);

      return res.status(500).json({
        message: "Unable to login.",
      });
    }
  }
);

// ─────────────────────────────────────────
// STAFF LOGIN
// ─────────────────────────────────────────
router.post(
  "/staff/login",
  loginLimiter,
  validate(loginSchema),
  async (req, res) => {
    try {
      const { identifier, password } = req.validated.body;

      const safeIdentifier = identifier.trim();

      const staff = await Staff.findOne({
        $or: [
          { email: new RegExp(`^${escapeRegex(safeIdentifier)}$`, "i") },
          { username: safeIdentifier },
          { phone: safeIdentifier },
        ],
      });


      // Don't reveal whether the account exists
      if (!staff) {
        return res.status(401).json({
          message: "Invalid credentials.",
        });
      }

      const validPassword = await bcrypt.compare(
        password,
        staff.password
      );

      if (!validPassword) {
        return res.status(401).json({
          message: "Invalid credentials.",
        });
      }

      const accessToken = signAccessToken(staff._id.toString(), "Staff");
      const { rawToken, expiresAt } = await issueRefreshToken(staff._id, "Staff");
      setRefreshCookie(res, rawToken, expiresAt);

      const safeStaff = staff.toObject();

      delete safeStaff.password;
      delete safeStaff.resetPasswordToken;
      delete safeStaff.resetPasswordExpires;

      return res.status(200).json({
        staff: safeStaff,
        accessToken,
      });

    } catch (err) {
      console.error("Staff login error:", err);

      return res.status(500).json({
        message: "Unable to login.",
      });
    }
  }
);


// ─────────────────────────────────────────
//  USER FORGOT / RESET PASSWORD
// ─────────────────────────────────────────
router.post("/forgot-password", loginLimiter, validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.validated.body;
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

// FIX: was validating against forgotPasswordSchema (expects { email }) instead of
// resetPasswordSchema (expects { password }) — this is why legitimate resets failed.
router.post("/reset-password/:token",
  validate(resetPasswordSchema), async (req, res) => {
  try {
    const { password } = req.validated.body;

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
router.post("/staff/forgot-password", loginLimiter,
  validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.validated.body;
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

router.post("/staff/reset-password/:token",
  validate(resetPasswordSchema), async (req, res) => {
  try {
    const { password } = req.validated.body;

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

// only an existing admin can promote another staff member
router.put("/staff/:id/promote", authenticate, requireAdmin, async (req, res) => {
  try {

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid staff ID.",
      });
    }
    const staff = await Staff.findByIdAndUpdate(
      req.params.id,
      { isAdmin: true },
      { new: true }
    ).select("-password");
    if (!staff) return res.status(404).json("Staff not found.");
    res.status(200).json(staff);
  } catch (err) {
    res.status(500).json("Server error");
  }
});


// ─────────────────────────────────────────
// REFRESH ACCESS TOKEN
// ─────────────────────────────────────────
router.post("/refresh", async (req, res) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!rawToken) {
      return res.status(401).json({ message: "No refresh token provided." });
    }

    const tokenHash = hashToken(rawToken);

    const stored = await RefreshToken.findOne({
      tokenHash,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!stored) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Invalid or expired session." });
    }

    // Rotate on every use: old token is dead, a new one takes its place.
    // This means a stolen-and-reused refresh token gets invalidated the
    // moment the real user's client refreshes next.
    stored.revoked = true;
    await stored.save();

    const { rawToken: newRawToken, expiresAt } = await issueRefreshToken(
      stored.ownerId,
      stored.ownerType
    );
    setRefreshCookie(res, newRawToken, expiresAt);

    const accessToken = signAccessToken(stored.ownerId.toString(), stored.ownerType);

    return res.status(200).json({ accessToken });
  } catch (err) {
    console.error("Refresh error:", err);
    return res.status(500).json({ message: "Unable to refresh session." });
  }
});

// ─────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────
router.post("/logout", async (req, res) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (rawToken) {
      await RefreshToken.updateOne(
        { tokenHash: hashToken(rawToken) },
        { revoked: true }
      );
    }

    clearRefreshCookie(res);
    return res.status(200).json({ message: "Logged out." });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Unable to log out." });
  }
});

module.exports = router;