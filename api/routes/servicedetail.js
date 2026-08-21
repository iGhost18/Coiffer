const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const Servicedetail = require("../models/servicedetail");

// GET all servicedetails belonging to a given service category
router.get("/service/:serviceId", async (req, res) => {
  try {
    const servicedetails = await Servicedetail.find({
      serviceId: req.params.serviceId,
    });
    res.status(200).json(servicedetails);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET single servicedetail by id
router.get("/:id", async (req, res) => {
  try {
    console.log("Requested ID:", req.params.id);

    const servicedetail = await Servicedetail.findById(req.params.id);

    console.log("Found:", servicedetail);

    if (!servicedetail) {
      return res.status(404).json("Servicedetail not found");
    }

    res.status(200).json(servicedetail);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

// CREATE a servicedetail
router.post("/", authenticate, async (req, res) => {
  try {
    if (!req.auth.isAdmin && (req.auth.type !== "Staff" || String(req.body.staffId) !== req.auth.id)) {
      return res.status(403).json("Only the owning staff member can create service details.");
    }
    const newServicedetail = new Servicedetail({ ...req.body, staffId: req.auth.type === "Staff" ? req.auth.id : req.body.staffId });
    const saved = await newServicedetail.save();
    res.status(200).json(saved);
  } catch (err) {
    res.status(500).json(err);
  }
});

// UPDATE a servicedetail
router.put("/:id", authenticate, async (req, res) => {
  try {
    const existing = await Servicedetail.findById(req.params.id);
    if (!existing) return res.status(404).json("Servicedetail not found");
    if (!req.auth.isAdmin && (req.auth.type !== "Staff" || String(existing.staffId) !== req.auth.id)) {
      return res.status(403).json("You can only update your own service details.");
    }
    const updated = await Servicedetail.findByIdAndUpdate(
      req.params.id,
      { $set: Object.fromEntries(Object.entries(req.body).filter(([key]) => ["name", "desc", "img", "duration", "price", "serviceId"].includes(key))) },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json(err);
  }
});

// DELETE a servicedetail
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const existing = await Servicedetail.findById(req.params.id);
    if (!existing) return res.status(404).json("Servicedetail not found");
    if (!req.auth.isAdmin && (req.auth.type !== "Staff" || String(existing.staffId) !== req.auth.id)) {
      return res.status(403).json("You can only delete your own service details.");
    }
    await Servicedetail.findByIdAndDelete(req.params.id);
    res.status(200).json("Servicedetail deleted");
  } catch (err) {
    res.status(500).json(err);
  }
});



// GET all servicedetails for a given staff member
router.get("/staff/:staffId", async (req, res) => {
  try {
    const servicedetails = await Servicedetail.find({
      staffId: req.params.staffId,
    });
    res.status(200).json(servicedetails);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;