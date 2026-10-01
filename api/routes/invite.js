const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const crypto = require("crypto");

const Invite = require("../models/invite");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/create", authenticate, requireAdmin, async (req, res) => {
    try {
        const { email, role } = req.body;

        if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
            return res.status(400).json({ message: "A valid email is required." });
        }

        const token = crypto.randomBytes(32).toString("hex");

        const invite = new Invite({
            email: email.trim().toLowerCase(),
            role: role || "staff",
            token,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        await invite.save();

        const inviteLink = `${process.env.CLIENT_URL || "http://localhost:3000"}/staffRegister/${token}`;

        res.status(201).json({
            message: "Invite created",
            inviteLink,
            invite,
        });
    } catch (err) {
        console.error("POST /invite/create failed:", err);
        res.status(500).json({ message: "Failed to create invite." });
    }
});

router.get("/verify/:token", async (req, res) => {
    try {
        const invite = await Invite.findOne({ token: req.params.token });

        if (!invite) {
            return res.status(404).json("Invalid invite.");
        }

        if (invite.used) {
            return res.status(400).json("Invite already used.");
        }

        if (invite.expiresAt < new Date()) {
            return res.status(400).json("Invite expired.");
        }

        res.status(200).json({
            valid: true,
            email: invite.email,
        });
    } catch (err) {
        console.error("GET /invite/verify failed:", err);
        res.status(500).json({ message: "Failed to verify invite." });
    }
});

router.get("/all", authenticate, requireAdmin, async (req, res) => {
    try {
        const invites = await Invite.find().sort({ createdAt: -1 });
        res.status(200).json(invites);
    } catch (err) {
        console.error("GET /invite/all failed:", err);
        res.status(500).json({ message: "Failed to fetch invites." });
    }
});

router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
    try {
        const deleted = await Invite.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json("Invite not found.");
        }

        res.status(200).json("Invite revoked.");
    } catch (err) {
        console.error("DELETE /invite/:id failed:", err);
        res.status(500).json({ message: "Failed to revoke invite." });
    }
});

module.exports = router;