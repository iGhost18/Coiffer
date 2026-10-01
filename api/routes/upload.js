const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const ffmpeg = require("fluent-ffmpeg");
const Invite = require("../models/invite");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;    // 5MB
const MAX_VIDEO_BYTES = 350 * 1024 * 1024;  // 350MB — generous ceiling for a 5-min clip at high bitrate
const MAX_VIDEO_SECONDS = 5 * 60;           // 5 minutes

// Temp uploads land here, briefly, before being pushed to Cloudinary and
// deleted. Using the OS temp dir means this never gets confused with
// anything else on disk and gets cleaned by the OS if the process ever
// crashes mid-upload without reaching our own cleanup code.
const TEMP_UPLOAD_DIR = path.join(os.tmpdir(), "ghostcutapp-uploads");
fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      // Random name, not the client's original filename — never trust or
      // reuse a filename supplied by the uploader.
      const randomName = crypto.randomBytes(16).toString("hex");
      cb(null, randomName);
    },
  }),
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowedImage = ["image/jpeg", "image/png", "image/webp"];
    const allowedVideo = ["video/mp4", "video/webm", "video/quicktime"];
    cb(null, allowedImage.includes(file.mimetype) || allowedVideo.includes(file.mimetype));
  },
});

cloudinary.config({
  CLOUDINARY_URL: process.env.CLOUDINARY_URL,
  timeout: 300000, // 5 minutes, matches our video duration cap in spirit
});

// Reads only the first 12 bytes of the file on disk to check its real
// format — same principle as before, just reading from a path instead of
// an in-memory buffer, since diskStorage no longer gives us req.file.buffer.
function sniffFileType(filePath) {
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(12);
  fs.readSync(fd, buffer, 0, 12, 0);
  fs.closeSync(fd);

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "video/webm";
  }
  if (buffer.slice(4, 8).toString("ascii") === "ftyp") {
    return "video/mp4";
  }
  return null;
}

// Returns duration in seconds via ffprobe, or rejects if the file can't be
// probed at all (e.g. a corrupt or non-media file that slipped past the
// magic-byte check).
function getVideoDurationSeconds(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata?.format?.duration;
      if (typeof duration !== "number" || Number.isNaN(duration)) {
        return reject(new Error("Could not determine video duration."));
      }
      resolve(duration);
    });
  });
}

function safeDeleteTempFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Failed to delete temp upload file:", filePath, err);
    }
  });
}

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many uploads from this IP, please try again later.",
});

router.post("/", uploadLimiter, upload.single("file"), async (req, res) => {
  let authenticated = false;
  let invite = null;
  const tempPath = req.file?.path;

  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      authenticated = Boolean(decoded?.id);
    } catch (_) {}
  }

  if (!authenticated) {
    const inviteToken = req.headers["x-invite-token"];
    if (!inviteToken) {
      if (tempPath) safeDeleteTempFile(tempPath);
      return res.status(401).json({ message: "Authentication or valid invite required." });
    }

    invite = await Invite.findOne({
      token: inviteToken,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      if (tempPath) safeDeleteTempFile(tempPath);
      return res.status(401).json({ message: "Invalid or expired invite." });
    }

    const MAX_UPLOADS_PER_INVITE = 3;
    if ((invite.uploadCount || 0) >= MAX_UPLOADS_PER_INVITE) {
      if (tempPath) safeDeleteTempFile(tempPath);
      return res.status(429).json({ message: "Upload limit reached for this invite." });
    }
  }

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded or unsupported file type." });
    }

    const realType = sniffFileType(tempPath);
    if (!realType) {
      safeDeleteTempFile(tempPath);
      return res.status(400).json({ message: "File is not a valid JPEG, PNG, WebP image, or MP4/WebM/MOV video." });
    }

    const isVideo = realType.startsWith("video/");

    if (isVideo && !authenticated) {
      safeDeleteTempFile(tempPath);
      return res.status(403).json({ message: "Video uploads require an authenticated staff account." });
    }

    if (!isVideo && req.file.size > MAX_IMAGE_BYTES) {
      safeDeleteTempFile(tempPath);
      return res.status(400).json({ message: `Images must be ${MAX_IMAGE_BYTES / (1024 * 1024)}MB or smaller.` });
    }

    if (isVideo) {
      let durationSeconds;
      try {
        durationSeconds = await getVideoDurationSeconds(tempPath);
      } catch (probeErr) {
        console.error("ffprobe failed:", probeErr);
        safeDeleteTempFile(tempPath);
        return res.status(400).json({ message: "Couldn't read this video file. It may be corrupted." });
      }

      if (durationSeconds > MAX_VIDEO_SECONDS) {
        safeDeleteTempFile(tempPath);
        return res.status(400).json({
          message: `Videos must be ${MAX_VIDEO_SECONDS / 60} minutes or shorter.`,
        });
      }
    }

    // upload_large streams from disk in chunks — the right call for
    // anything that could be tens or hundreds of MB, versus buffering the
    // whole thing in one request the way the old memory-based flow did.
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_large(
        tempPath,
        { folder: "ghostcutapp", resource_type: isVideo ? "video" : "image" },
        (error, uploadResult) => {
          if (uploadResult) resolve(uploadResult);
          else reject(error);
        }
      );
    });

    if (invite) {
      invite.uploadCount = (invite.uploadCount || 0) + 1;
      await invite.save();
    }

    res.json({ url: result.secure_url, publicId: result.public_id, resourceType: isVideo ? "video" : "image" });
  } catch (err) {
    console.error("POST /upload failed:", err);
    res.status(500).json({ message: "Upload failed." });
  } finally {
    // Always clean up the temp file, success or failure — this is the
    // whole point of moving off memoryStorage: nothing should accumulate
    // on disk across requests.
    if (tempPath) safeDeleteTempFile(tempPath);
  }
});

module.exports = router;