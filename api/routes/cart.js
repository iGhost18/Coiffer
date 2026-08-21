const { authenticate } = require("../middleware/auth");
const router = require("express").Router();
const Cart = require("../models/cart");

/*
=========================
GET CART
=========================
*/
router.get("/:ownerType/:ownerId", authenticate, async (req, res) => {
  try {
    const { ownerType, ownerId } = req.params;
    if (String(ownerId) !== req.auth.id) return res.status(403).json({ message: "Access denied." });

    let cart = await Cart.findOne({
      ownerId,
      ownerType,
    });

    if (!cart) {
      cart = {
        ownerId,
        ownerType,
        items: [],
      };
    }

    res.status(200).json(cart);
  } catch (err) {
    res.status(500).json(err);
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

    let cart = await Cart.findOne({
      ownerId,
      ownerType,
    });

    if (!cart) {
      cart = new Cart({
        ownerId,
        ownerType,
        items: [],
      });
    }

    const existing = cart.items.find(
      (i) =>
        i.itemId === item.itemId &&
        i.itemType === item.itemType
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
    console.error(err);
    res.status(500).json(err);
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

    const cart = await Cart.findOne({
      ownerId,
      ownerType,
    });

    if (!cart) {
      return res.status(404).json("Cart not found");
    }

    const item = cart.items.find(
      (i) =>
        i.itemId === itemId &&
        i.itemType === itemType
    );

    if (!item) {
      return res.status(404).json("Item not found");
    }

    item.quantity += delta;

    if (item.quantity <= 0) {
      cart.items = cart.items.filter(
        (i) =>
          !(
            i.itemId === itemId &&
            i.itemType === itemType
          )
      );
    }

    await cart.save();

    res.status(200).json(cart);
  } catch (err) {
    res.status(500).json(err);
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

    const cart = await Cart.findOne({
      ownerId,
      ownerType,
    });

    if (!cart) {
      return res.status(404).json("Cart not found");
    }

    cart.items = cart.items.filter(
      (i) =>
        !(
          i.itemId === itemId &&
          i.itemType === itemType
        )
    );

    await cart.save();

    res.status(200).json(cart);
  } catch (err) {
    res.status(500).json(err);
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

    const cart = await Cart.findOne({
      ownerId,
      ownerType,
    });

    if (!cart) {
      return res.status(404).json("Cart not found");
    }

    cart.items = [];

    await cart.save();

    res.status(200).json(cart);
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;