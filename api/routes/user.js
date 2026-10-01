const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const mongoose = require("mongoose");
const User = require("../models/user");
const Staff = require("../models/staff");
const bcrypt = require("bcrypt");
const Notification = require("../models/notification");
const validate = require("../middleware/validate");
const { updateUserProfileSchema } = require("../validation/profileSchemas");
const { sendNotification } = require("../socket/index");

const escapeRegex = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Fields any user may edit on their own account.
const selfEditableFields = [
    "username", "firstName", "lastName", "phone", "birthMonth", "birthDay",
    "state", "city", "country", "gender", "hairType", "hairColor",
    "hairStyle", "profilePicture", "bio", "personalNote", "email", "featured", "collection"
];

// Fields only an admin can set — these are curation/marketing flags, not
// something a user should be able to grant themselves through their own
// profile-edit form.
const adminOnlyFields = [];

// Fields safe to show to anyone, including unauthenticated visitors
// (public profile view). Everything else — email, phone, birthday,
// personalNote, etc. — is private and only returned to the owner or an admin.
const PUBLIC_PROFILE_FIELDS =
    "username profilePicture bio hairType hairColor hairStyle followers followings likes createdAt " +
    "gender birthMonth birthDay city state country collection featured";
// UPDATE USER
router.put("/:id", authenticate, validate(updateUserProfileSchema), async (req, res) => {
    if (!(req.auth.isAdmin || (req.auth.type === "User" && req.auth.id === req.params.id))) {
        return res.status(403).json("You can update only your account");
    }

    try {
        const allowedFields = req.auth.isAdmin
            ? [...selfEditableFields, ...adminOnlyFields]
            : selfEditableFields;

        const updates = Object.fromEntries(
            Object.entries(req.validated.body).filter(([key]) => allowedFields.includes(key))
        );

        if (updates.email) {
            updates.email = updates.email.toLowerCase().trim();

            const existing = await User.findOne({
                _id: { $ne: req.params.id },
                email: new RegExp(`^${escapeRegex(updates.email)}$`, "i"),
            }).select("_id");

            if (existing) {
                return res.status(409).json({ message: "That email is already in use." });
            }
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json("User not found");
        }

        res.status(200).json("Account has been updated");
    } catch (err) {
        console.error("PUT /user/:id failed:", err);

        if (err.code === 11000) {
            return res.status(409).json({ message: "One of those values is already in use." });
        }

        return res.status(500).json({ message: "Failed to update account." });
    }
});


// CHANGE PASSWORD (verifies the current password first, unlike the
// generic update route above which never touches password at all —
// "password" is intentionally left out of allowedFields there)
router.put("/:id/password", authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (req.auth.type !== "User" || req.auth.id !== req.params.id) {
        return res.status(403).json({
            message: "You can only change your own password."
        });
    }

    if (!currentPassword || !newPassword) {
        return res.status(400).json("Current and new password are required");
    }

    if (String(newPassword).length < 8) {
        return res.status(400).json("New password must be at least 8 characters.");
    }

    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json("User not found");
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(401).json("Current password is incorrect");
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        await user.save();

        res.status(200).json("Password updated");
    } catch (err) {
        console.error("PUT /user/:id/password failed:", err);
        res.status(500).json({ message: "Failed to update password." });
    }
});


// DELETE USER
router.delete("/:id", authenticate, async (req, res) => {
    if (!(req.auth.isAdmin || (req.auth.type === "User" && req.auth.id === req.params.id))) {
        return res.status(403).json("You can delete only your account");
    }

    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json("User not found");
        }

        res.status(200).json("Account has been deleted");
    } catch (err) {
        console.error("DELETE /user/:id failed:", err);
        return res.status(500).json({ message: "Failed to delete account." });
    }
});

// GET A USER
// Public route: returns only the safe public subset unless the caller is
// the profile owner or an admin, in which case the full record is returned.
router.get("/", async (req, res) => {
    const userId = req.query.userId;
    const username = req.query.username;

    try {
        if (userId && !mongoose.isValidObjectId(userId)) {
            return res.status(400).json("Invalid user id");
        }

        const query = userId
            ? User.findById(userId)
            : User.findOne({ username });

        const user = await query;

        if (!user) {
            return res.status(404).json("user not found");
        }

        // Determine viewer identity without requiring auth — a Bearer token
        // may or may not be present on this public endpoint.
        let viewerId = null;
        let viewerIsAdmin = false;
        const authHeader = req.headers.authorization || "";
        if (authHeader.startsWith("Bearer ")) {
            try {
                const jwt = require("jsonwebtoken");
                const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
                viewerId = decoded?.id || null;
                viewerIsAdmin = Boolean(decoded?.isAdmin);
            } catch (_) {
                // invalid/expired token on a public route just means "treat as anonymous"
            }
        }

        const isOwnerOrAdmin = viewerIsAdmin || (viewerId && viewerId === String(user._id));

        if (isOwnerOrAdmin) {
            const { password, resetPasswordToken, resetPasswordExpires, updatedAt, ...safeUser } = user._doc;
            return res.status(200).json(safeUser);
        }

        // Anonymous / non-owner: only the safe public subset.
        const publicUser = await User.findById(user._id).select(PUBLIC_PROFILE_FIELDS);
        return res.status(200).json(publicUser);
    } catch (err) {
        console.error("GET /user failed:", err);
        return res.status(500).json({ message: "Failed to fetch user." });
    }
});

// GET ALL USERS (admin dashboard)
router.get("/all", authenticate, requireAdmin, async (req, res) => {
    try {
        const users = await User.find().select(
            "-password -resetPasswordToken -resetPasswordExpires"
        );
        res.status(200).json(users);
    } catch (err) {
        console.error("GET /user/all failed:", err);
        res.status(500).json({ message: "Failed to fetch users." });
    }
});

// FOLLOW A USER
router.put("/:id/follow", authenticate, async (req, res) => {
    if (req.auth.type === "User" && req.auth.id !== req.params.id) {
        try {
            const user = await User.findById(req.params.id);
            const currentUser = await User.findById(req.auth.id);
            if (!user || !currentUser) return res.status(404).json("User not found.");
            if (!user.followers.includes(req.auth.id)) {
                await user.updateOne({ $push: { followers: req.auth.id } });
                await currentUser.updateOne({ $push: { followings: req.params.id } });
                res.status(200).json("user has been followed");
            } else {
                res.status(403).json("you already follow this user");
            }
        } catch (err) {
            console.error("PUT /user/:id/follow failed:", err);
            res.status(500).json({ message: "Failed to follow user." });
        }
    } else {
        res.status(403).json("you cant follow yourself");
    }
});

// UNFOLLOW A USER
router.put("/:id/unfollow", authenticate, async (req, res) => {
    if (req.auth.type === "User" && req.auth.id !== req.params.id) {
        try {
            const user = await User.findById(req.params.id);
            const currentUser = await User.findById(req.auth.id);
            if (!user || !currentUser) return res.status(404).json("User not found.");
            if (user.followers.includes(req.auth.id)) {
                await user.updateOne({ $pull: { followers: req.auth.id } });
                await currentUser.updateOne({ $pull: { followings: req.params.id } });
                res.status(200).json("user has been unfollowed");
            } else {
                res.status(403).json("you dont follow this user");
            }
        } catch (err) {
            console.error("PUT /user/:id/unfollow failed:", err);
            res.status(500).json({ message: "Failed to unfollow user." });
        }
    } else {
        res.status(403).json("you cant unfollow yourself");
    }
});

router.get("/:id/groomers", authenticate, async (req, res) => {
    try {
        if (!req.auth.isAdmin && !(req.auth.type === "User" && req.auth.id === req.params.id)) {
            return res.status(403).json({ message: "Access denied." });
        }

        const user = await User.findById(req.params.id).populate("groomers");

        if (!user) {
            return res.status(404).json("User not found");
        }

        res.status(200).json(user.groomers);
    } catch (err) {
        console.error("GET /user/:id/groomers failed:", err);
        res.status(500).json({ message: "Failed to fetch groomers." });
    }
});



// ─────────────────────────────────────────
//  USER — LIKE (by a User or a Staff member)
// ─────────────────────────────────────────
router.put("/:id/like", authenticate, async (req, res) => {
    try {
        if (String(req.body.likerId) !== req.auth.id) return res.status(403).json("Invalid liker identity.");
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json("User not found");

        if (req.params.id === req.body.likerId) {
            return res.status(403).json("You can't like your own profile");
        }

        // check both User and Staff models
        let liker = await User.findById(req.body.likerId);
        let likerIsStaff = false;

        if (!liker) {
            liker = await Staff.findById(req.body.likerId);
            likerIsStaff = true;
        }

        if (!liker) return res.status(404).json("Liker not found");

        if (user.likes.includes(req.body.likerId)) {
            return res.status(403).json("You already liked this profile");
        }

        await user.updateOne({ $push: { likes: req.body.likerId } });

        const notification = await Notification.create({
            senderId: liker._id,
            senderModel: likerIsStaff ? "Staff" : "User",
            receiverId: user._id,
            receiverModel: "User",
            type: "like",
            text: `${liker.username} liked your profile.`,
        });

        const populatedNotification = await Notification.findById(notification._id)
            .populate("senderId", "username profilePicture");

        sendNotification(user._id.toString(), populatedNotification);

        res.status(200).json("Profile liked.");
    } catch (err) {
        console.error("PUT /user/:id/like failed:", err);
        res.status(500).json({ message: "Failed to like profile." });
    }
});

// ─────────────────────────────────────────
//  USER — UNLIKE
// ─────────────────────────────────────────
router.put("/:id/unlike", authenticate, async (req, res) => {
    try {
        if (String(req.body.likerId) !== req.auth.id) return res.status(403).json("Invalid liker identity.");
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json("User not found");

        if (!user.likes.includes(req.body.likerId)) {
            return res.status(403).json("You haven't liked this profile");
        }

        await user.updateOne({ $pull: { likes: req.body.likerId } });

        res.status(200).json("Profile unliked.");
    } catch (err) {
        console.error("PUT /user/:id/unlike failed:", err);
        res.status(500).json({ message: "Server error." });
    }
});

module.exports = router;

