const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Staff = require("../models/staff");
const User = require("../models/user");
const Post = require("../models/post");
const Notification = require("../models/notification");
const Booking = require("../models/booking");
const { sendNotification } = require("../../socket/index");
const geocodeAddress = require("../utils/geocode");
const validate = require("../middleware/validate");
const { updateStaffProfileSchema } = require("../validation/profileSchemas");

require("dotenv").config();

// Fields safe to show anyone browsing the barber directory or a public
// profile — no email, no phone, no precise coordinates, no client list,
// no isAdmin, no payout info. Adjust the list to match what your frontend
// directory/profile page actually needs to render.
const PUBLIC_STAFF_FIELDS =
    "username firstName lastName displayName profilePicture coverPicture desc " +
    "roles experience workType specialties workDays schedule followers followings " +
    "location.city location.state location.country createdAt collection featured " +
    "rating ratingCount";
    
router.get("/", async (req, res) => {
    try {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const today = days[new Date().getDay()];

        const staffList = await Staff.find().select(PUBLIC_STAFF_FIELDS);

        const availableToday = staffList.filter((s) => {
            const worksToday = !s.workDays?.length || s.workDays.includes(today);
            const todaySchedule = s.schedule?.[today];
            const notClosed = !todaySchedule || todaySchedule.isOpen !== false;
            return worksToday && notClosed;
        });

        // NOTE: the previous version computed `availableToday` but returned
        // the full unfiltered `staffList` — that looked like an unintentional
        // bug given the amount of logic built around it, so this now returns
        // the filtered list. If you actually want every staff member listed
        // (with availability as a separate flag the frontend uses), say so
        // and I'll switch this back to returning everyone with an
        // `availableToday: true/false` field attached instead.
        res.status(200).json(availableToday);
    } catch (err) {
        console.error("GET /staff failed:", err);
        res.status(500).json({ message: "Failed to fetch staff." });
    }
});

// routes/staff.js — GET /map
router.get("/map", async (req, res) => {
    try {
        const staff = await Staff.find().select(
            "firstName lastName displayName username profilePicture roles workType location"
        );

        const data = staff.map((s) => ({
            _id: s._id,
            name: s.displayName || `${s.firstName} ${s.lastName}`.trim() || s.username,
            username: s.username,
            role: s.roles?.length > 0 ? s.roles.join(" · ") : "Professional",
            photoUrl: s.profilePicture,
            lat: s.location?.coordinates?.lat,
            lng: s.location?.coordinates?.lng,
            workType: s.workType,
        }));

        res.json(data);
    } catch (err) {
        console.error("GET /staff/map failed:", err);
        res.status(500).json({ message: "Failed to fetch staff map data." });
    }
});

// ─────────────────────────────────────────
//  STAFF — UPDATE LOCATION
// ─────────────────────────────────────────
router.put("/:id/location", authenticate, async (req, res) => {
    try {
        let isAdmin = false;
        if (req.auth.type === "Staff") {
            const staffDoc = await Staff.findById(req.auth.id).select("isAdmin").lean();
            isAdmin = staffDoc?.isAdmin === true;
        }

        if (!isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) {
            return res.status(403).json("You can only update your own location.");
        }

        const { lat, lng } = req.body;

        if (
            typeof lat !== "number" || typeof lng !== "number" ||
            !Number.isFinite(lat) || !Number.isFinite(lng) ||
            lat < -90 || lat > 90 || lng < -180 || lng > 180
        ) {
            return res.status(400).json("Invalid coordinates.");
        }

        await Staff.findByIdAndUpdate(req.params.id, {
            $set: {
                "location.coordinates.lat": lat,
                "location.coordinates.lng": lng,
            },
        });

        res.status(200).json("Location updated");
    } catch (err) {
        console.error("PUT /staff/:id/location failed:", err);
        res.status(500).json({ message: "Failed to update location." });
    }
});

router.get("/profile/:id", async (req, res) => {
    try {
        const posts = await Post.find({ staffId: req.params.id });
        res.status(200).json(posts);
    } catch (err) {
        console.error("GET /staff/profile/:id failed:", err);
        res.status(500).json({ message: "Failed to fetch posts." });
    }
});

// ─────────────────────────────────────────
//  STAFF — GET (by staffId)
// ─────────────────────────────────────────
// Public route: returns the safe public subset unless the caller is this
// staff member themself or an admin, in which case the full record
// (email, phone, precise location, clients, etc.) is returned.
router.get("/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json("Invalid staff id");
        }

        let viewerId = null;
        let viewerIsAdmin = false;
        const authHeader = req.headers.authorization || "";
        if (authHeader.startsWith("Bearer ")) {
            try {
                const jwt = require("jsonwebtoken");
                const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
                viewerId = decoded?.id || null;

                if (decoded?.type === "Staff" && viewerId) {
                    const viewerDoc = await Staff.findById(viewerId).select("isAdmin").lean();
                    viewerIsAdmin = viewerDoc?.isAdmin === true;
                }
            } catch (_) {
                // invalid/expired token on a public route just means "treat as anonymous"
            }
        }

        const isOwnerOrAdmin = viewerIsAdmin || viewerId === req.params.id;

        if (isOwnerOrAdmin) {
            const staff = await Staff.findById(req.params.id).select(
                "-password -resetPasswordToken -resetPasswordExpires"
            );
            if (!staff) return res.status(404).json("Staff not found");
            const { updatedAt, ...other } = staff._doc;
            return res.status(200).json(other);
        }

        const staff = await Staff.findById(req.params.id).select(PUBLIC_STAFF_FIELDS);
        if (!staff) return res.status(404).json("Staff not found");
        res.status(200).json(staff);
    } catch (err) {
        console.error("GET /staff/:id failed:", err);
        res.status(500).json({ message: "Failed to fetch staff." });
    }
});

// ─────────────────────────────────────────
//  STAFF — UPDATE
// ─────────────────────────────────────────
router.put("/:id", authenticate, validate(updateStaffProfileSchema), async (req, res) => {
    try {
        let isAdmin = false;
        if (req.auth.type === "Staff") {
            const staffDoc = await Staff.findById(req.auth.id).select("isAdmin").lean();
            isAdmin = staffDoc?.isAdmin === true;
        }

        if (!isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) {
            return res.status(403).json("You can only update your own account.");
        }

        const body = { ...req.validated.body };

        if (body.password) {
            const salt = await bcrypt.genSalt(10);
            body.password = await bcrypt.hash(body.password, salt);
        }

        if (body.location?.address) {
            const coordinates = await geocodeAddress(body.location.address);

            if (coordinates) {
                body.location.coordinates = {
                    lat: coordinates.lat,
                    lng: coordinates.lng,
                };
            }
        }

        const allowedFields = [
            "username", "displayName", "firstName", "lastName", "phone", "desc", "roles",
            "experience", "workType", "location", "specialties", "workDays",
            "profilePicture", "coverPicture", "services", "schedule",
            "collection", "featured"
        ];
        const updates = Object.fromEntries(
            Object.entries(body).filter(([key]) => allowedFields.includes(key))
        );

        const staff = await Staff.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!staff) {
            return res.status(404).json("Staff not found");
        }

        res.status(200).json("Account has been updated.");
    } catch (err) {
        console.error("PUT /staff/:id failed:", err);

        if (err.code === 11000) {
            return res.status(409).json({ message: "One of those values is already in use." });
        }

        res.status(500).json({ message: "Failed to update account." });
    }
});

// STAFF CHANGE PASSWORD
router.put("/:id/password", authenticate, async (req, res) => {
    if (req.auth.type !== "Staff" || req.auth.id !== req.params.id) {
        return res.status(403).json("You can only change your own password.");
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
        return res.status(400).json("Current password and a new password of at least 8 characters are required.");
    }
    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) return res.status(404).json("Staff not found.");
        if (!(await bcrypt.compare(currentPassword, staff.password))) {
            return res.status(401).json("Current password is incorrect.");
        }
        staff.password = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
        await staff.save();
        res.status(200).json("Password updated.");
    } catch (err) {
        console.error("PUT /staff/:id/password failed:", err);
        res.status(500).json({ message: "Failed to update password." });
    }
});

// ─────────────────────────────────────────
//  STAFF — DELETE
// ─────────────────────────────────────────
router.delete("/:id", authenticate, async (req, res) => {
    try {
        let isAdmin = false;
        if (req.auth.type === "Staff") {
            const staffDoc = await Staff.findById(req.auth.id).select("isAdmin").lean();
            isAdmin = staffDoc?.isAdmin === true;
        }

        if (!isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) {
            return res.status(403).json("You can only delete your own account.");
        }

        const staff = await Staff.findByIdAndDelete(req.params.id);
        if (!staff) return res.status(404).json("Staff not found.");
        res.status(200).json("Account has been deleted.");
    } catch (err) {
        console.error("DELETE /staff/:id failed:", err);
        res.status(500).json({ message: "Failed to delete account." });
    }
});

// ─────────────────────────────────────────
//  STAFF — FOLLOW
// ─────────────────────────────────────────
router.put("/:staffId/follow", authenticate, async (req, res) => {
    try {
        const { staffId } = req.params;

        if (staffId === req.auth.id) {
            return res.status(403).json("You cannot follow yourself.");
        }

        const staff = await Staff.findById(staffId);
        if (!staff) return res.status(404).json("Staff not found.");

        if (staff.followers.includes(req.auth.id)) {
            return res.status(409).json("You are already following this staff.");
        }

        let followerDoc, followerModel;

        if (req.auth.type === "User") {
            followerDoc = await User.findById(req.auth.id);
            followerModel = "User";
        } else if (req.auth.type === "Staff") {
            followerDoc = await Staff.findById(req.auth.id);
            followerModel = "Staff";
        } else {
            return res.status(403).json("Not allowed to follow.");
        }

        if (!followerDoc) return res.status(404).json("Follower not found.");

        await staff.updateOne({ $push: { followers: req.auth.id } });
        await followerDoc.updateOne({ $push: { followings: staffId } });

        const notification = await Notification.create({
            senderId: followerDoc._id,
            senderModel: followerModel,
            receiverId: staff._id,
            receiverModel: "Staff",
            type: "follow",
            text: `${followerDoc.username} started following you.`
        });

        const populatedNotification = await Notification.findById(notification._id)
            .populate("senderId", "username profilePicture");

        sendNotification(staff._id.toString(), populatedNotification);

        res.status(200).json("Followed.");
    } catch (err) {
        console.error("PUT /staff/:staffId/follow failed:", err);
        res.status(500).json({ message: "Failed to follow staff." });
    }
});

// ─────────────────────────────────────────
//  STAFF — UNFOLLOW
// ─────────────────────────────────────────
router.put("/:staffId/unfollow", authenticate, async (req, res) => {
    try {
        const { staffId } = req.params;

        const staff = await Staff.findById(staffId);
        if (!staff) return res.status(404).json("Staff not found.");

        if (!staff.followers.includes(req.auth.id)) {
            return res.status(409).json("You are not following this staff.");
        }

        let followerDoc;

        if (req.auth.type === "User") {
            followerDoc = await User.findById(req.auth.id);
        } else if (req.auth.type === "Staff") {
            followerDoc = await Staff.findById(req.auth.id);
        } else {
            return res.status(403).json("Not allowed to unfollow.");
        }

        if (!followerDoc) return res.status(404).json("Follower not found.");

        await staff.updateOne({ $pull: { followers: req.auth.id } });
        await followerDoc.updateOne({ $pull: { followings: staffId } });

        res.status(200).json("Unfollowed.");
    } catch (err) {
        console.error("PUT /staff/:staffId/unfollow failed:", err);
        res.status(500).json({ message: "Failed to unfollow staff." });
    }
});


router.get("/:id/clients", authenticate, async (req, res) => {
    try {
        let isAdmin = false;
        if (req.auth.type === "Staff") {
            const staffDoc = await Staff.findById(req.auth.id).select("isAdmin").lean();
            isAdmin = staffDoc?.isAdmin === true;
        }

        if (!isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) {
            return res.status(403).json("Access denied.");
        }

        const staff = await Staff.findById(req.params.id).populate("clients");

        if (!staff) {
            return res.status(404).json("Staff not found");
        }

        res.status(200).json(staff.clients);
    } catch (err) {
        console.error("GET /staff/:id/clients failed:", err);
        res.status(500).json({ message: "Failed to fetch clients." });
    }
});

router.put("/:id/addClient", authenticate, async (req, res) => {
    try {
        let isAdmin = false;
        if (req.auth.type === "Staff") {
            const staffDoc = await Staff.findById(req.auth.id).select("isAdmin").lean();
            isAdmin = staffDoc?.isAdmin === true;
        }

        if (!isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) {
            return res.status(403).json("Only the staff member can manage their clients.");
        }

        const staff = await Staff.findById(req.params.id);
        const user = await User.findById(req.body.userId);

        if (!staff || !user) {
            return res.status(404).json("User or Staff not found");
        }

        // Require an actual (non-cancelled) booking between the two before
        // staff can unilaterally declare someone their client — otherwise
        // any staff member could tag any customer by ID with no relationship
        // between them at all.
        const hasBooking = await Booking.exists({
            staffId: staff._id,
            customerId: user._id,
            status: { $ne: "cancelled" },
        });

        if (!hasBooking) {
            return res.status(403).json({
                message: "You can only add clients you've had a booking with.",
            });
        }

        if (!staff.clients.includes(user._id)) {
            staff.clients.push(user._id);
            await staff.save();
        }

        if (!user.groomers.includes(staff._id)) {
            user.groomers.push(staff._id);
            await user.save();
        }

        res.status(200).json("Client added");
    } catch (err) {
        console.error("PUT /staff/:id/addClient failed:", err);
        res.status(500).json({ message: "Failed to add client." });
    }
});

router.put("/:id/removeClient", authenticate, async (req, res) => {
    try {
        let isAdmin = false;
        if (req.auth.type === "Staff") {
            const staffDoc = await Staff.findById(req.auth.id).select("isAdmin").lean();
            isAdmin = staffDoc?.isAdmin === true;
        }

        if (!isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) {
            return res.status(403).json("Only the staff member can manage their clients.");
        }

        const staff = await Staff.findById(req.params.id);
        const user = await User.findById(req.body.userId);

        if (!staff || !user) {
            return res.status(404).json("User or Staff not found");
        }

        staff.clients = staff.clients.filter(
            (clientId) => String(clientId) !== String(user._id)
        );
        await staff.save();

        user.groomers = user.groomers.filter(
            (groomerId) => String(groomerId) !== String(staff._id)
        );
        await user.save();

        res.status(200).json("Client removed");
    } catch (err) {
        console.error("PUT /staff/:id/removeClient failed:", err);
        res.status(500).json({ message: "Failed to remove client." });
    }
});


router.put("/:id/addGroomer", authenticate, async (req, res) => {
    try {
        if (req.auth.type !== "User") {
            return res.status(403).json({
                message: "Only customers can add a groomer.",
            });
        }

        if (req.body?.userId && String(req.body.userId) !== req.auth.id) {
            return res.status(403).json({
                message: "You can only manage your own groomer list.",
            });
        }

        const staff = await Staff.findById(req.params.id);
        const user = await User.findById(req.auth.id);

        if (!staff || !user) {
            return res.status(404).json("User or Staff not found");
        }

        const alreadyAdded = user.groomers.includes(staff._id);

        if (!alreadyAdded) {
            user.groomers.push(staff._id);
            await user.save();
        }

        if (!staff.clients.includes(user._id)) {
            staff.clients.push(user._id);
            await staff.save();
        }

        // Only notify on the first add — otherwise a customer can spam a
        // staff member's notifications by calling this repeatedly.
        if (!alreadyAdded) {
            const notification = await Notification.create({
                senderId: user._id,
                senderModel: "User",
                receiverId: staff._id,
                receiverModel: "Staff",
                type: "groomer",
                text: `${user.username} added you as a groomer.`,
            });

            const populatedNotification = await Notification.findById(notification._id)
                .populate("senderId", "username profilePicture");

            sendNotification(staff._id.toString(), populatedNotification);
        }

        res.status(200).json("Groomer added");
    } catch (err) {
        console.error("PUT /staff/:id/addGroomer failed:", err);
        res.status(500).json({ message: "Failed to add groomer." });
    }
});

// Symmetric removal — same self-only rule, no booking check either.
router.put("/:id/removeGroomer", authenticate, async (req, res) => {
    try {
        if (req.auth.type !== "User") {
            return res.status(403).json({
                message: "Only customers can remove a groomer.",
            });
        }

        const staff = await Staff.findById(req.params.id);
        const user = await User.findById(req.auth.id);

        if (!staff || !user) {
            return res.status(404).json("User or Staff not found");
        }

        staff.clients = staff.clients.filter(
            (clientId) => String(clientId) !== String(user._id)
        );
        await staff.save();

        user.groomers = user.groomers.filter(
            (groomerId) => String(groomerId) !== String(staff._id)
        );
        await user.save();

        res.status(200).json("Groomer removed");
    } catch (err) {
        console.error("PUT /staff/:id/removeGroomer failed:", err);
        res.status(500).json({ message: "Failed to remove groomer." });
    }
});

// ─────────────────────────────────────────
//  STAFF — ADMIN LIST (full roster, no availability filter)
// ─────────────────────────────────────────
router.get("/admin/all", authenticate, requireAdmin, async (req, res) => {
    try {
        const staffList = await Staff.find().select(
            "-password -resetPasswordToken -resetPasswordExpires"
        );
        res.status(200).json(staffList);
    } catch (err) {
        console.error("GET /staff/admin/all failed:", err);
        res.status(500).json({ message: "Failed to fetch staff." });
    }
});

module.exports = router;