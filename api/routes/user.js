const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const User = require("../models/user");
const Staff = require("../models/staff");
const bcrypt = require("bcrypt");
const Notification = require("../models/notification");
const { sendNotification } = require("../../socket/index");

// UPDATE USER
router.put("/:id", authenticate, async(req, res)=>{
    if (req.auth.isAdmin || (req.auth.type === "User" && req.auth.id === req.params.id)) {
        if(req.body.password){
            try {
                const salt =  await bcrypt.genSalt(10);
                req.body.password = await bcrypt.hash(req.body.password, salt);
            } catch (err) {
                return res.status(500).json(err);
            }
        }
        try{
            const allowedFields = [
                "username", "name", "phone", "birthday", "birthMonth", "birthDay",
                "state", "city", "country", "gender", "hairType", "hairColor",
                "hairStyle", "favoritesCollection", "featured", "profilePicture"
            ];
            const updates = Object.fromEntries(
                Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
            );
            const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
            res.status(200).json("Account has been updated");
        } catch (err) {
            return res.status(500).json(err);
        }
    }  else {
        return res.status(403).json("You can update only your account");
    }  
})

// CHANGE PASSWORD (verifies the current password first, unlike the
// generic update route above which will happily overwrite the password
// field for anyone who can supply the right userId)
router.put("/:id/password", authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (req.auth.type !== "User" || req.auth.id !== req.params.id) {
        return res.status(403).json({
            message: "You can only change your own password."
        });
    }
    
    if (req.auth.type !== "User") {return res.status(403).json({
        message: "Only users can add groomers."});
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
        res.status(500).json(err);
    }
});

// DELETE USER
router.delete("/:id", authenticate, async(req, res)=>{
    if (req.auth.isAdmin || (req.auth.type === "User" && req.auth.id === req.params.id)) {
        try{
            const user = await User.findByIdAndDelete(req.params.id);
            res.status(200).json("Account has been deleted");
        } catch (err) {
            return res.status(500).json(err);
        }
    }  else {
        return res.status(403).json("You can delete only your account");
    }  
});

// GET A USER
router.get("/", async (req, res)=>{
    const userId = req.query.userId;
    const username = req.query.username;
    try{
        const query = userId
          ? User.findById(userId)
          : User.findOne({ username: username });

        const user = await query.select(
            "-password -resetPasswordToken -resetPasswordExpires"
        );

        if(!user){
            return res.status(404).json("user not found");
        }
        const {updatedAt, ...other} = user._doc;
        res.status(200).json(other); 
    }catch (err) {
        return res.status(500).json(err);
    }
})

// GET ALL USERS (admin dashboard)
router.get("/all", authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json(err);
  }
});

// FOLLOW A STAFF
router.put("/:id/follow", authenticate, async (req, res)=> {
    if (req.auth.type === "User" && req.auth.id !== req.params.id){
        try{
            const user = await User.findById(req.params.id);
            const currentUser = await User.findById(req.auth.id);
            if (!user || !currentUser) return res.status(404).json("User not found.");
            if(!user.followers.includes(req.auth.id)){
                await user.updateOne({$push: {followers: req.auth.id}});
                await currentUser.updateOne({$push: {followings: req.params.id  }});
                res.status(200).json("user has been followed");
            }else {
                res.status(403).json("you already follow this user");
            }
        }catch (err){
            res.status(500).json(err);
        }
    }else{
        res.status(403).json("you cant follow yourself");
    }
})

// UNFOLLOW A STAFF
router.put("/:id/unfollow", authenticate, async (req, res)=> {
    if (req.auth.type === "User" && req.auth.id !== req.params.id){
        try{
            const user = await User.findById(req.params.id);
            const currentUser = await User.findById(req.auth.id);
            if (!user || !currentUser) return res.status(404).json("User not found.");
            if(user.followers.includes(req.auth.id)){
                await user.updateOne({$pull: {followers: req.auth.id}});
                await currentUser.updateOne({$pull: {followings: req.params.id  }});
                res.status(200).json("user has been followed");
            }else {
                res.status(403).json("you dont follow this user");
            }
        }catch (err){
            res.status(500).json(err);
        }
    }else{
        res.status(403).json("you cant unfollow yourself");
    }
})

router.get("/:id/groomers", authenticate, async (req, res) => {
  try {
    if (!req.auth.isAdmin && !(req.auth.type === "User" && req.auth.id === req.params.id)) return res.status(403).json({ message: "Access denied." });
    const user = await User.findById(req.params.id)
      .populate("groomers");

    if (!user) {
      return res.status(404).json("User not found");
    }

    res.status(200).json(user.groomers);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.put("/:id/addGroomer", authenticate, async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);
        const user = await User.findById(req.auth.id);

        if (!staff || !user) {
            return res.status(404).json("User or Staff not found");
        }

        if (!user.groomers.includes(staff._id)) {
            user.groomers.push(staff._id);
            await user.save();
        }

        if (!staff.clients.includes(user._id)) {
            staff.clients.push(user._id);
            await staff.save();
        }

        // -------------------------
        // Create notification
        // -------------------------
        const notification = await Notification.create({
            senderId: user._id,
            senderModel: "User",

            receiverId: staff._id,
            receiverModel: "Staff",

            type: "groomer",

            text: `${user.username} added you as a groomer.`,
        });

        const populatedNotification =
            await Notification.findById(notification._id)
                .populate("senderId", "username profilePicture");

            sendNotification(
            staff._id.toString(),
            populatedNotification
        );

        res.status(200).json({
            message: "Groomer added successfully",
            groomers: user.groomers,
            clients: staff.clients,
        });
    } catch (err) {
        res.status(500).json(err);
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

        sendNotification(user._id.toString(), notification);

        res.status(200).json("Profile liked.");
    } catch (err) {
        res.status(500).json(err);
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
        res.status(500).json({message: " server  error."});
    }
});

module.exports = router;


