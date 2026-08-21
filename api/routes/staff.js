const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const bcrypt = require("bcrypt");
const Staff = require("../models/staff");
const User = require("../models/user");
const Post = require("../models/post");
const Invite = require("../models/invite");
const Notification = require("../models/notification");
const { sendNotification } = require("../../socket/index");
const geocodeAddress  = require("../utils/geocode");


require("dotenv").config();

router.get("/", async (req, res) => {
    try {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const today = days[new Date().getDay()];

        const staffList = await Staff.find().select(
            "-password -resetPasswordToken -resetPasswordExpires"
        );

        const availableToday = staffList.filter((s) => {
            const worksToday =
                !s.workDays?.length || s.workDays.includes(today);

            const todaySchedule = s.schedule?.[today];

            const notClosed =
                !todaySchedule || todaySchedule.isOpen !== false;

            return worksToday && notClosed;
        });
        res.status(200).json(staffList);
    } catch (err) {
        console.error(err);
        res.status(500).json(err.message);
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
      name:
        s.displayName ||
        `${s.firstName} ${s.lastName}`.trim() ||
        s.username,

      role:
        s.roles?.length > 0
          ? s.roles.join(" · ")
          : "Professional",

      photoUrl: s.profilePicture,
      lat: s.location?.coordinates?.lat,
      lng: s.location?.coordinates?.lng,
      workType: s.workType,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.put("/:id/location", authenticate, async (req, res) => {
    if (!req.auth.isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) return res.status(403).json("You can only update your own location.");
    try {
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
        res.status(500).json(err);
    }
});

router.get("/profile/:id", async(req,res)=>{

    try{

        const posts = await Post.find({
            staffId:req.params.id
        });

        res.status(200).json(posts);

    }catch(err){

        res.status(500).json(err);

    }

});


// ─────────────────────────────────────────
//  STAFF — GET (by staffId or username)
// ─────────────────────────────────────────
router.get("/:id", async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id).select(
            "-password -resetPasswordToken -resetPasswordExpires"
        );

        if (!staff) return res.status(404).json("Staff not found");

        const { updatedAt, ...other } = staff._doc;
        res.status(200).json(other);

    } catch (err) {
        res.status(500).json(err);
    }
});



// ─────────────────────────────────────────
//  STAFF — UPDATE
// ─────────────────────────────────────────
router.put("/:id", authenticate, async (req, res) => {
    if (!req.auth.isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) {
        return res.status(403).json("You can only update your own account.");
    }

    try {
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            req.body.password = await bcrypt.hash(req.body.password, salt);
        }

        if (req.body.location?.address) {

            const coordinates = await geocodeAddress(
                req.body.location.address
            );

            if (coordinates) {
                req.body.location.coordinates = {
                    lat: coordinates.lat,
                    lng: coordinates.lng,
                };
            }
        }

        const allowedFields = [
            "username", "firstName", "lastName", "phone", "desc", "roles",
            "experience", "workType", "location", "specialties", "workDays",
            "profilePicture", "coverPicture", "services", "schedule"
        ];
        const updates = Object.fromEntries(
            Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
        );
        if (updates.schedule && !req.auth.isAdmin && req.auth.type !== "Staff") {
            delete updates.schedule;
        }
        await Staff.findByIdAndUpdate(req.params.id, { $set: updates }, { runValidators: true });
        const updated = await Staff.findById(req.params.id);


        res.status(200).json("Account has been updated.");

    } catch (err) {
        res.status(500).json({
            message: err.message,
        });
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
        res.status(500).json({ message: "Failed to update password." });
    }
});

// ─────────────────────────────────────────
//  STAFF — DELETE
// ─────────────────────────────────────────
router.delete("/:id", authenticate, async (req, res) => {
    if (!req.auth.isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) {
        return res.status(403).json("You can only delete your own account.");
    }

    try {
        await Staff.findByIdAndDelete(req.params.id);
        res.status(200).json("Account has been deleted.");

    } catch (err) {
        res.status(500).json(err);
    }
});

// ─────────────────────────────────────────
//  STAFF — FOLLOW
// ─────────────────────────────────────────
router.put("/:staffId/follow", authenticate, async (req, res) => {
    try {
        if (req.auth.type !== "User") return res.status(403).json("Only users can follow staff.");
        req.body.userid = req.auth.id;
        const staff = await Staff.findById(req.params.staffId);
        
        // check both User and Staff models
        let follower = await User.findById(req.body.userid);
        let followerIsStaff = false;

        if (!follower) {
            follower = await Staff.findById(req.body.userid);
            followerIsStaff = true;
        }

        if (!staff) return res.status(404).json("Staff not found.");
        if (!follower) return res.status(404).json("Follower not found.");

        if (staff.followers.includes(req.body.userid)) {
            return res.status(403).json("You are already following this staff.");
        }

        await staff.updateOne({ $push: { followers: req.body.userid } });
        await follower.updateOne({ $push: { followings: req.params.staffId } });

        const notification = await Notification.create({
            senderId: follower._id,
            senderModel: followerIsStaff ? "Staff" : "User",

            receiverId: staff._id,
            receiverModel: "Staff",

            type: "follow",

            text: `${follower.username} started following you.`
        });

        sendNotification(
            staff._id.toString(),
            notification
        );

        res.status(200).json("Followed.");

    } catch (err) {
        res.status(500).json(err);
    }
});


// ─────────────────────────────────────────
//  STAFF — UNFOLLOW
// ─────────────────────────────────────────
router.put("/:staffId/unfollow", authenticate, async (req, res) => {
    try {
        if (req.auth.type !== "User") return res.status(403).json("Only users can unfollow staff.");
        req.body.userid = req.auth.id;
        const staff = await Staff.findById(req.params.staffId);

        // check both User and Staff models
        let follower = await User.findById(req.body.userid);

        if (!follower) {
            follower = await Staff.findById(req.body.userid);
        }

        if (!staff) return res.status(404).json("Staff not found.");
        if (!follower) return res.status(404).json("Follower not found.");

        if (!staff.followers.includes(req.body.userid)) {
            return res.status(403).json("You are not following this staff.");
        }

        await staff.updateOne({ $pull: { followers: req.body.userid } });
        await follower.updateOne({ $pull: { followings: req.params.staffId } });

        res.status(200).json("Unfollowed.");

    } catch (err) {
        res.status(500).json(err);
    }
});

router.get("/:id/clients", authenticate, async (req, res) => {
  try {
    if (!req.auth.isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) return res.status(403).json("Access denied.");
    const staff = await Staff.findById(req.params.id)
      .populate("clients");

    if (!staff) {
      return res.status(404).json("Staff not found");
    }

    res.status(200).json(staff.clients);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.put("/:id/addClient", authenticate, async (req, res) => {
  try {
    if (!req.auth.isAdmin && !(req.auth.type === "Staff" && req.auth.id === req.params.id)) return res.status(403).json("Only the staff member can manage their clients.");
    const staff = await Staff.findById(req.params.id);
    const user = await User.findById(req.body.userId);

    if (!staff || !user) {
      return res.status(404).json("User or Staff not found");
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
    res.status(500).json(err);
  }
});




module.exports = router;