const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();
const mongoose = require("mongoose");
const Service = require("../models/services");
const Staff = require("../models/staff");

require("dotenv").config();

// ─────────────────────────────────────────
//  SERVICES — GET ALL (now staff-scoped)
// ─────────────────────────────────────────
router.get("/", async (req, res) => {
    try {
        const filter = {};
        if (req.query.staffId) {
            if (!mongoose.isValidObjectId(req.query.staffId)) {
                return res.status(400).json({ message: "Invalid staff id." });
            }
            filter.staffId = req.query.staffId;
        }
        const services = await Service.find(filter);
        res.status(200).json(services);
    } catch (err) {
        console.error("GET /services failed:", err);
        res.status(500).json({ message: "Failed to fetch services." });
    }
});

// ─────────────────────────────────────────
//  SERVICES — GET ONE
// ─────────────────────────────────────────
router.get("/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json("Invalid service id");
        }

        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json("Service not found");
        res.status(200).json(service);
    } catch (err) {
        console.error("GET /services/:id failed:", err);
        res.status(500).json({ message: "Failed to fetch service." });
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

        if (!req.body.label || !String(req.body.label).trim()) {
            return res.status(400).json({ message: "Label is required." });
        }

        const staffId = req.auth.type === "Staff" ? req.auth.id : req.body.staffId;

        if (!staffId || !mongoose.isValidObjectId(staffId)) {
            return res.status(400).json({ message: "A valid staff id is required." });
        }

        // Only needed on the admin-on-behalf-of path — a Staff caller's own
        // id is already known-good from their auth token.
        if (req.auth.type !== "Staff") {
            const staffExists = await Staff.exists({ _id: staffId });
            if (!staffExists) {
                return res.status(400).json({ message: "Staff member not found." });
            }
        }

        const newService = new Service({
            label: req.body.label.trim(),
            img: req.body.img,
            staffId,
        });

        const saved = await newService.save();
        res.status(201).json(saved);
    } catch (err) {
        console.error("POST /services failed:", err);
        res.status(500).json({ message: "Failed to create service." });
    }
});

// ─────────────────────────────────────────
//  SERVICES — UPDATE (only the owning staff member)
// ─────────────────────────────────────────
router.put("/:id", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json("Invalid service id");
        }

        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json("Service not found");

        if (!req.auth.isAdmin && (req.auth.type !== "Staff" || req.auth.id !== service.staffId.toString())) {
            return res.status(403).json("You can only update your own service.");
        }

        const updates = {};
        for (const key of ["label", "img"]) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        if (updates.label !== undefined && !String(updates.label).trim()) {
            return res.status(400).json({ message: "Label cannot be empty." });
        }

        const updated = await Service.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );
        res.status(200).json(updated);
    } catch (err) {
        console.error("PUT /services/:id failed:", err);
        res.status(500).json({ message: "Failed to update service." });
    }
});

// ─────────────────────────────────────────
//  SERVICES — DELETE (only the owning staff member)
// ─────────────────────────────────────────
router.delete("/:id", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json("Invalid service id");
        }

        const service = await Service.findById(req.params.id);
        if (!service) return res.status(404).json("Service not found");

        if (!req.auth.isAdmin && (req.auth.type !== "Staff" || req.auth.id !== service.staffId.toString())) {
            return res.status(403).json("You can only delete your own service.");
        }

        await Service.findByIdAndDelete(req.params.id);
        res.status(200).json("Service has been deleted.");
    } catch (err) {
        console.error("DELETE /services/:id failed:", err);
        res.status(500).json({ message: "Failed to delete service." });
    }
});

module.exports = router;