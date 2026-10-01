const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const Cart = require("../models/cart");

const VALID_ITEM_TYPES = ["service", "product"];

function ownerTypeMatchesAuth(ownerType, authType) {
  return String(ownerType).toLowerCase() === String(authType).toLowerCase();
}

/*
=========================
GET CART
=========================
*/
router.get("/:ownerType/:ownerId", authenticate, async (req, res) => {
  try {
    const { ownerType, ownerId } = req.params;
    if (String(ownerId) !== req.auth.id) return res.status(403).json({ message: "Access denied." });
    if (!ownerTypeMatchesAuth(ownerType, req.auth.type)) {
      return res.status(403).json({ message: "Invalid owner type." });
    }

    let cart = await Cart.findOne({ ownerId, ownerType });

    if (!cart) {
      cart = { ownerId, ownerType, items: [] };
    }

    res.status(200).json(cart);
  } catch (err) {
    console.error("GET /cart/:ownerType/:ownerId failed:", err);
    res.status(500).json({ message: "Failed to fetch cart." });
  }
});

/*
=========================
ADD ITEM
=========================
*/
router.post("/add", authenticate, async (req, res) => {
  try {
    const { ownerId, ownerType, item } = req.body;
    if (String(ownerId) !== req.auth.id) return res.status(403).json({ message: "Access denied." });
    if (!ownerTypeMatchesAuth(ownerType, req.auth.type)) {
      return res.status(403).json({ message: "Invalid owner type." });
    }

    if (!item || !item.itemId || !VALID_ITEM_TYPES.includes(item.itemType)) {
      return res.status(400).json({
        message: `item.itemId is required and item.itemType must be one of: ${VALID_ITEM_TYPES.join(", ")}.`,
      });
    }

    let cart = await Cart.findOne({ ownerId, ownerType });

    if (!cart) {
      cart = new Cart({ ownerId, ownerType, items: [] });
    }

    const existing = cart.items.find(
      (i) => String(i.itemId) === String(item.itemId) && i.itemType === item.itemType
    );

    if (existing) {
      existing.quantity += 1;

      if (item.duration !== undefined) {
        existing.duration = item.duration;
      }

      if (item.serviceId !== undefined) {
        existing.serviceId = item.serviceId;
      }
    } else {
      cart.items.push({
        itemId: item.itemId,
        itemType: item.itemType,
        staffId: item.staffId,
        serviceId: item.serviceId,
        name: item.name,
        img: item.img,
        price: item.price,
        quantity: 1,
        duration: item.duration,
      });
    }

    await cart.save();

    res.status(200).json(cart);
  } catch (err) {
    console.error("POST /cart/add failed:", err);
    res.status(500).json({ message: "Failed to add item to cart." });
  }
});

/*
=========================
UPDATE QUANTITY
=========================
*/
router.put("/quantity", authenticate, async (req, res) => {
  try {
    const { ownerId, ownerType, itemId, itemType, delta } = req.body;
    if (String(ownerId) !== req.auth.id) return res.status(403).json({ message: "Access denied." });
    if (!ownerTypeMatchesAuth(ownerType, req.auth.type)) {
      return res.status(403).json({ message: "Invalid owner type." });
    }

    const numericDelta = Number(delta);
    if (!Number.isFinite(numericDelta) || !Number.isInteger(numericDelta) || numericDelta === 0) {
      return res.status(400).json({ message: "delta must be a non-zero integer." });
    }

    const cart = await Cart.findOne({ ownerId, ownerType });

    if (!cart) {
      return res.status(404).json("Cart not found");
    }

    const item = cart.items.find(
      (i) => String(i.itemId) === String(itemId) && i.itemType === itemType
    );

    if (!item) {
      return res.status(404).json("Item not found");
    }

    item.quantity += numericDelta;

    if (item.quantity <= 0) {
      cart.items = cart.items.filter(
        (i) => !(String(i.itemId) === String(itemId) && i.itemType === itemType)
      );
    } else {
      // Keep cart quantities within the same bound checkout already
      // enforces, so the displayed cart never diverges from what a
      // purchase would actually clamp it to.
      item.quantity = Math.min(item.quantity, 20);
    }

    await cart.save();

    res.status(200).json(cart);
  } catch (err) {
    console.error("PUT /cart/quantity failed:", err);
    res.status(500).json({ message: "Failed to update quantity." });
  }
});

/*
=========================
REMOVE ITEM
=========================
*/
router.delete("/remove", authenticate, async (req, res) => {
  try {
    const { ownerId, ownerType, itemId, itemType } = req.body;
    if (String(ownerId) !== req.auth.id) return res.status(403).json({ message: "Access denied." });
    if (!ownerTypeMatchesAuth(ownerType, req.auth.type)) {
      return res.status(403).json({ message: "Invalid owner type." });
    }

    const cart = await Cart.findOne({ ownerId, ownerType });

    if (!cart) {
      return res.status(404).json("Cart not found");
    }

    cart.items = cart.items.filter(
      (i) => !(String(i.itemId) === String(itemId) && i.itemType === itemType)
    );

    await cart.save();

    res.status(200).json(cart);
  } catch (err) {
    console.error("DELETE /cart/remove failed:", err);
    res.status(500).json({ message: "Failed to remove item." });
  }
});

/*
=========================
CLEAR CART
=========================
*/
router.delete("/clear/:ownerType/:ownerId", authenticate, async (req, res) => {
  try {
    const { ownerId, ownerType } = req.params;

    if (String(ownerId) !== req.auth.id) {
      return res.status(403).json({ message: "Access denied." });
    }
    if (!ownerTypeMatchesAuth(ownerType, req.auth.type)) {
      return res.status(403).json({ message: "Invalid owner type." });
    }

    const cart = await Cart.findOne({ ownerId, ownerType });

    if (!cart) {
      return res.status(404).json("Cart not found");
    }

    cart.items = [];

    await cart.save();

    res.status(200).json(cart);
  } catch (err) {
    console.error("DELETE /cart/clear failed:", err);
    res.status(500).json({ message: "Failed to clear cart." });
  }
});

module.exports = router;