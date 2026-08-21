const { authenticate, requireAdmin } = require("../middleware/auth");
const { Router } = require("express");
const Product = require("../models/product");

const router = Router();

// GET /api/products — list all products
router.get("/", async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products", details: err.message });
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
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, price, stock, category, image, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Product name is required" });
    }
    const product = await Product.create({
      name,
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      category,
      image,
      description,
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: "Failed to create product", details: err.message });
  }
});

// PUT /api/products/:id
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, price, stock, category, image, description } = req.body;
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price: Number(price) || 0 }),
        ...(stock !== undefined && { stock: Number(stock) || 0 }),
        ...(category !== undefined && { category }),
        ...(image !== undefined && { image }),
        ...(description !== undefined && { description }),
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: "Product not found" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: "Failed to update product", details: err.message });
  }
});

// DELETE /api/products/:id
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true, _id: req.params.id });
  } catch (err) {
    res.status(400).json({ error: "Failed to delete product", details: err.message });
  }
});

module.exports = router;