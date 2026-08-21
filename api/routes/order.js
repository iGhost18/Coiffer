const { authenticate, requireAdmin } = require("../middleware/auth");
const router = require("express").Router();

const Order = require("../models/order");
const Schedule = require("../models/schedule");

// Order.status and Schedule.status use different vocabularies
// (Order: pending/fulfilled/cancelled — Schedule: pending/confirmed/
// processing/completed/delivered/cancelled), so an order status update
// has to be translated before it's written onto the Schedule doc.
const ORDER_TO_SCHEDULE_STATUS = {
  pending: "pending",
  fulfilled: "delivered",
  cancelled: "cancelled",
};

/*
========================================
GET ALL ORDERS (admin dashboard)
========================================
*/
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("customerId", "username profilePicture")
      .sort({ createdAt: -1 });

    res.status(200).json(orders);
  } catch (err) {
    console.error("GET /order failed:", err);
    res.status(500).json({ message: "Failed to fetch orders." });
  }
});

/*
========================================
CREATE ORDER
========================================
*/
router.post("/", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "User") return res.status(403).json({ message: "Only customers can create orders." });
    req.body.customerId = req.auth.id;
    const order = new Order(req.body);
    const savedOrder = await order.save();

    try {
      await Schedule.create({
        type: "order",
        orderId: savedOrder._id,
        userId: savedOrder.customerId,
        title: savedOrder.items.map((i) => i.name).join(", "),
        subtitle: savedOrder.paymentMethod,
        date: savedOrder.createdAt,
        status: "pending",
        amount: savedOrder.total,
      });
    } catch (scheduleErr) {
      console.error("Schedule creation for order failed:", scheduleErr);
    }

    res.status(201).json(savedOrder);
  } catch (err) {
    console.error("POST /order failed:", err);
    res.status(500).json({ message: "Failed to create order." });
  }
});

/*
========================================
USER ORDERS
========================================
*/
router.get("/user/:userId", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "User" || req.auth.id !== String(req.params.userId)) return res.status(403).json({ message: "Access denied." });
    const orders = await Order.find({ customerId: req.params.userId }).sort({
      createdAt: -1,
    });

    res.status(200).json(orders);
  } catch (err) {
    console.error("GET /order/user/:userId failed:", err);
    res.status(500).json({ message: "Failed to fetch orders." });
  }
});

/*
========================================
UPDATE ORDER STATUS
========================================
*/
router.put("/:id/status", authenticate, requireAdmin, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { status: req.body.status } },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const scheduleStatus = ORDER_TO_SCHEDULE_STATUS[order.status] ?? "pending";

    await Schedule.findOneAndUpdate(
      { orderId: order._id },
      { $set: { status: scheduleStatus } }
    );

    res.status(200).json(order);
  } catch (err) {
    console.error("PUT /order/:id/status failed:", err);
    res.status(500).json({ message: "Failed to update order status." });
  }
});

/*
========================================
DELETE ORDER
========================================
*/
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    await Schedule.findOneAndDelete({ orderId: req.params.id });
    res.status(200).json("Order deleted.");
  } catch (err) {
    console.error("DELETE /order/:id failed:", err);
    res.status(500).json({ message: "Failed to delete order." });
  }
});

module.exports = router;