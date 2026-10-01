const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const mongoose = require("mongoose");
const Servicedetail = require("../models/servicedetail");

const ALLOWED_FIELDS = ["name", "desc", "img", "duration", "price", "serviceId"];

function validatePrice(price) {
  const n = Number(price);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// GET all servicedetails belonging to a given service category
router.get("/service/:serviceId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.serviceId)) {
      return res.status(400).json("Invalid service id");
    }

    const servicedetails = await Servicedetail.find({
      serviceId: req.params.serviceId,
    });
    res.status(200).json(servicedetails);
  } catch (err) {
    console.error("GET /servicedetail/service/:serviceId failed:", err);
    res.status(500).json({ message: "Failed to fetch service details." });
  }
});

// GET single servicedetail by id
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json("Invalid servicedetail id");
    }

    const servicedetail = await Servicedetail.findById(req.params.id);

    if (!servicedetail) {
      return res.status(404).json("Servicedetail not found");
    }

    res.status(200).json(servicedetail);
  } catch (err) {
    console.error("GET /servicedetail/:id failed:", err);
    res.status(500).json({ message: "Failed to fetch service detail." });
  }
});

// CREATE a servicedetail
router.post("/", authenticate, async (req, res) => {
  try {
    if (!req.auth.isAdmin && (req.auth.type !== "Staff" || String(req.body.staffId) !== req.auth.id)) {
      return res.status(403).json("Only the owning staff member can create service details.");
    }

    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => ALLOWED_FIELDS.includes(key))
    );

    if (!updates.name || !String(updates.name).trim()) {
      return res.status(400).json("Service name is required.");
    }

    const validatedPrice = validatePrice(updates.price);
    if (validatedPrice === null) {
      return res.status(400).json("Price must be a valid, non-negative number.");
    }
    updates.price = validatedPrice;

    if (!updates.duration || !String(updates.duration).trim()) {
      return res.status(400).json("Duration is required.");
    }

    const newServicedetail = new Servicedetail({
      ...updates,
      staffId: req.auth.type === "Staff" ? req.auth.id : req.body.staffId,
    });

    const saved = await newServicedetail.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("POST /servicedetail failed:", err);
    res.status(500).json({ message: "Failed to create service detail." });
  }
});

// UPDATE a servicedetail
router.put("/:id", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json("Invalid servicedetail id");
    }

    const existing = await Servicedetail.findById(req.params.id);
    if (!existing) return res.status(404).json("Servicedetail not found");
    if (!req.auth.isAdmin && (req.auth.type !== "Staff" || String(existing.staffId) !== req.auth.id)) {
      return res.status(403).json("You can only update your own service details.");
    }

    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => ALLOWED_FIELDS.includes(key))
    );

    if (updates.price !== undefined) {
      const validatedPrice = validatePrice(updates.price);
      if (validatedPrice === null) {
        return res.status(400).json("Price must be a valid, non-negative number.");
      }
      updates.price = validatedPrice;
    }

    const updated = await Servicedetail.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json(updated);
  } catch (err) {
    console.error("PUT /servicedetail/:id failed:", err);
    res.status(500).json({ message: "Failed to update service detail." });
  }
});

// DELETE a servicedetail
router.delete("/:id", authenticate, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json("Invalid servicedetail id");
    }

    const existing = await Servicedetail.findById(req.params.id);
    if (!existing) return res.status(404).json("Servicedetail not found");
    if (!req.auth.isAdmin && (req.auth.type !== "Staff" || String(existing.staffId) !== req.auth.id)) {
      return res.status(403).json("You can only delete your own service details.");
    }
    await Servicedetail.findByIdAndDelete(req.params.id);
    res.status(200).json("Servicedetail deleted");
  } catch (err) {
    console.error("DELETE /servicedetail/:id failed:", err);
    res.status(500).json({ message: "Failed to delete service detail." });
  }
});

// GET all servicedetails for a given staff member
router.get("/staff/:staffId", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.staffId)) {
      return res.status(400).json("Invalid staff id");
    }

    const servicedetails = await Servicedetail.find({
      staffId: req.params.staffId,
    });
    res.status(200).json(servicedetails);
  } catch (err) {
    console.error("GET /servicedetail/staff/:staffId failed:", err);
    res.status(500).json({ message: "Failed to fetch service details." });
  }
});

module.exports = router;