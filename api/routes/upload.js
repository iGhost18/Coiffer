const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const jwt = require("jsonwebtoken");
const Invite = require("../models/invite");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Configure Cloudinary
cloudinary.config({
  CLOUDINARY_URL: process.env.CLOUDINARY_URL
});

router.post("/", upload.single("file"), async (req, res) => {
  // Authenticated users may upload. Staff registration may upload only with
  // a valid, unused invite token; this avoids exposing a free Cloudinary proxy.
  let authenticated = false;
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      authenticated = Boolean(decoded?.id);
    } catch (_) {}
  }
  if (!authenticated) {
    const inviteToken = req.headers["x-invite-token"];
    if (!inviteToken) return res.status(401).json({ message: "Authentication or valid invite required." });
    const invite = await Invite.findOne({ token: inviteToken, used: false, expiresAt: { $gt: new Date() } }).select("_id");
    if (!invite) return res.status(401).json({ message: "Invalid or expired invite." });
  }
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded or unsupported file type." });
    }

    // Upload buffer directly to Cloudinary via stream
    const streamUpload = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "ghostcutapp", resource_type: "image" },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

    const result = await streamUpload();

    // Return the secure URL
    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;