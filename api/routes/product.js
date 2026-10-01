const { authenticate, requireAdmin } = require("../middleware/auth");
const { Router } = require("express");
const Product = require("../models/product");
const validate = require("../middleware/validate");
const { createProductSchema, updateProductSchema } = require("../validation/productSchemas");

const router = Router();

// GET /api/products — list all products
router.get("/", async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("GET /product failed:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: "Invalid product id" });
  }
});

// POST /api/products
router.post("/", authenticate, requireAdmin, validate(createProductSchema), async (req, res) => {
  try {
    const { name, price, discountPrice, category, image, description, available } = req.validated.body;

    const product = await Product.create({
      name,
      price,
      discountPrice: discountPrice || null,
      category,
      image,
      description,
      available: available !== undefined ? available : true,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("POST /product failed:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: "Failed to create product" });
  }
});


// PUT /api/products/:id
router.put("/:id", authenticate, requireAdmin, validate(updateProductSchema), async (req, res) => {
  try {
    // Load first, apply changes, then .save() — this makes `this` inside
    // the discountPrice validator the actual document (with the final
    // merged price), not the raw update query, so the "discount must be
    // lower than price" check works correctly even when only one of the
    // two fields is being changed in this request.
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    Object.assign(product, req.validated.body);
    await product.save();

    res.json(product);
  } catch (err) {
    console.error("PUT /product failed:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /api/products/:id
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true, _id: req.params.id });
  } catch (err) {
    res.status(400).json({ error: "Invalid product id" });
  }
});

module.exports = router;