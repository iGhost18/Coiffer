const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const Service = require("../models/services");

require("dotenv").config();



// ─────────────────────────────────────────
//  SERVICES — GET ALL (now staff-scoped)
// ─────────────────────────────────────────
router.get("/", async (req, res) => {
    try {
        const filter = {};
        if (req.query.staffId) {
            filter.staffId = req.query.staffId;
        }
        const services = await Service.find(filter);
        res.status(200).json(services);
    } catch (err) {
        console.log("SERVICES FETCH ERROR:", err);
        res.status(500).json({ message: err.message });
    }
});

// ─────────────────────────────────────────
//  SERVICES — GET ONE
// ─────────────────────────────────────────
router.get("/:id", async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json("Service not found");
        res.status(200).json(service);
    } catch (err) {
        res.status(500).json(err);
    }
});

// ─────────────────────────────────────────
//  SERVICES — CREATE
// ─────────────────────────────────────────
router.post("/", authenticate, async (req, res) => {
    try {
        if (!req.auth.isAdmin && req.auth.type !== "Staff") {
            return res.status(403).json("Only staff can create services.");
        }
        const newService = new Service({
            label: req.body.label,
            img: req.body.img,
            staffId: req.auth.type === "Staff" ? req.auth.id : req.body.staffId,
        });

        const saved = await newService.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json(err);
    }
});

// ─────────────────────────────────────────
//  SERVICES — UPDATE (only the owning staff member)
// ─────────────────────────────────────────
router.put("/:id", authenticate, async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json("Service not found");

        if (!req.auth.isAdmin && (req.auth.type !== "Staff" || req.auth.id !== service.staffId.toString())) {
            return res.status(403).json("You can only update your own service.");
        }

        const updates = {};
        for (const key of ["label", "img"]) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        await Service.findByIdAndUpdate(req.params.id, { $set: updates }, { runValidators: true });
        res.status(200).json("Service has been updated.");
    } catch (err) {
        res.status(500).json(err);
    }
});

// ─────────────────────────────────────────
//  SERVICES — DELETE (only the owning staff member)
// ─────────────────────────────────────────
router.delete("/:id", authenticate, async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json("Service not found");

        if (!req.auth.isAdmin && (req.auth.type !== "Staff" || req.auth.id !== service.staffId.toString())) {
            return res.status(403).json("You can only delete your own service.");
        }

        await Service.findByIdAndDelete(req.params.id);
        res.status(200).json("Service has been deleted.");
    } catch (err) {
        res.status(500).json(err);
    }
});

module.exports = router;