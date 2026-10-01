const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const {
  authenticate,
  requireAdmin,
} = require("../middleware/auth");

const {
  sendNotification,
} = require("../../socket");

const {
  createNotification,
} = require("../utils/createNotification");

const Order = require("../models/order");
const Schedule = require("../models/schedule");
const Product = require("../models/product");
const sendEmail = require("../utils/sendEmail");
const { deliveryUpdateEmail } = require("../utils/emailTemplates");

const {
  computeDeliveryWindow,
} = require("../utils/delivery");


// ============================================================
// ORDER STATUS
// ============================================================

const ORDER_TO_SCHEDULE_STATUS = {
  pending: "pending",
  fulfilled: "delivered",
  cancelled: "cancelled",
};

const ORDER_STATUSES = Object.keys(
  ORDER_TO_SCHEDULE_STATUS
);


// ============================================================
// DELIVERY STATUS
// ============================================================

const DELIVERY_PROGRESSION = [
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

const DELIVERY_TO_SCHEDULE_STATUS = {
  delivered: "delivered",
};


// ============================================================
// DELIVERY NOTIFICATION MESSAGES
// ============================================================

const DELIVERY_MESSAGES = {
  shipped:
    "Your order has been shipped and is on its way.",

  out_for_delivery:
    "Your order is out for delivery today.",

  delivered:
    "Your order has been delivered successfully.",
};


// ============================================================
// HELPERS
// ============================================================

function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}


// ============================================================
// GET ALL ORDERS
// ADMIN ONLY
// ============================================================

router.get(
  "/",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const orders = await Order.find()
        .populate(
          "customerId",
          "username profilePicture"
        )
        .sort({ createdAt: -1 });

      return res.status(200).json(orders);
    } catch (err) {
      console.error(
        "GET /order failed:",
        err
      );

      return res.status(500).json({
        message: "Failed to fetch orders.",
      });
    }
  }
);


// ============================================================
// CREATE ORDER
// CUSTOMER ONLY
// ============================================================

router.post(
  "/",
  authenticate,
  async (req, res) => {
    try {
      // Only normal users can create orders.
      if (req.auth.type !== "User") {
        return res.status(403).json({
          message:
            "Only customers can create orders.",
        });
      }

      const {
        contact,
        address,
        paymentMethod,
        items,
      } = req.body;


      // --------------------------------------------------------
      // Validate contact
      // --------------------------------------------------------

      if (
        !contact?.name ||
        !contact?.email ||
        !contact?.phone
      ) {
        return res.status(400).json({
          message:
            "Complete contact information is required.",
        });
      }


      // --------------------------------------------------------
      // Validate payment method
      // --------------------------------------------------------

      if (!paymentMethod) {
        return res.status(400).json({
          message:
            "Payment method is required.",
        });
      }


      // --------------------------------------------------------
      // Validate cart
      // --------------------------------------------------------

      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res.status(400).json({
          message: "Your cart is empty.",
        });
      }


      // --------------------------------------------------------
      // Get product IDs
      // --------------------------------------------------------

      const productIds = items.map(
        (item) =>
          item.itemId ||
          item.productId ||
          item._id
      );


      if (
        productIds.some(
          (id) => !mongoose.isValidObjectId(id)
        )
      ) {
        return res.status(400).json({
          message:
            "One or more product IDs are invalid.",
        });
      }


      // --------------------------------------------------------
      // Get authoritative products from MongoDB
      // --------------------------------------------------------

      const productDetails =
        await Product.find({
          _id: {
            $in: productIds,
          },
        });


      const uniqueProductIds =
        new Set(
          productIds.map(String)
        );


      if (
        productDetails.length !==
        uniqueProductIds.size
      ) {
        return res.status(400).json({
          message:
            "One or more products could not be found.",
        });
      }


      const productById =
        new Map(
          productDetails.map(
            (product) => [
              product._id.toString(),
              product,
            ]
          )
        );


      // --------------------------------------------------------
      // Build authoritative order items
      // --------------------------------------------------------

      const authoritativeItems =
        items.map((item) => {
          const key = String(
            item.itemId ||
            item.productId ||
            item._id
          );

          const detail =
            productById.get(key);

          if (!detail) {
            throw new Error(
              "Product not found."
            );
          }

          const quantity = Math.max(
            1,
            Math.min(
              20,
              Number(item.quantity) || 1
            )
          );

          return {
            itemId: detail._id,
            name: detail.name,
            price: detail.price,
            quantity,
            img: detail.img,
          };
        });


      // --------------------------------------------------------
      // Calculate total from database prices
      // --------------------------------------------------------

      const total = roundMoney(
        authoritativeItems.reduce(
          (sum, item) =>
            sum +
            Number(item.price) *
              item.quantity,
          0
        )
      );


      if (total <= 0) {
        return res.status(400).json({
          message:
            "Invalid order amount.",
        });
      }


      // --------------------------------------------------------
      // Calculate delivery window
      // --------------------------------------------------------

      const {
        estimatedDeliveryStart,
        estimatedDeliveryEnd,
      } =
        computeDeliveryWindow(
          address
        );


      // --------------------------------------------------------
      // Create order
      // --------------------------------------------------------

      const order = new Order({
        customerId: req.auth.id,

        contact,

        address,

        items: authoritativeItems,

        paymentMethod,

        total,

        status: "pending",

        deliveryStatus:
          "processing",

        estimatedDeliveryStart,

        estimatedDeliveryEnd,
      });


      const savedOrder =
        await order.save();


      // --------------------------------------------------------
      // Create schedule entry
      // --------------------------------------------------------

      try {
        await Schedule.create({
          type: "order",

          orderId:
            savedOrder._id,

          userId:
            savedOrder.customerId,

          title:
            savedOrder.items
              .map((item) => item.name)
              .join(", "),

          subtitle:
            savedOrder.paymentMethod,

          date:
            savedOrder.createdAt,

          status: "pending",

          amount:
            savedOrder.total,
        });
      } catch (scheduleErr) {
        console.error(
          "Schedule creation for order failed:",
          scheduleErr
        );
      }


      return res.status(201).json(
        savedOrder
      );
    } catch (err) {
      console.error(
        "POST /order failed:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to create order.",
      });
    }
  }
);


// ============================================================
// GET USER ORDERS
// CUSTOMER ONLY
// ============================================================

router.get(
  "/user/:userId",
  authenticate,
  async (req, res) => {
    try {
      if (
        req.auth.type !== "User" ||
        req.auth.id !==
          String(req.params.userId)
      ) {
        return res.status(403).json({
          message: "Access denied.",
        });
      }


      const orders =
        await Order.find({
          customerId:
            req.params.userId,
        }).sort({
          createdAt: -1,
        });


      return res.status(200).json(
        orders
      );
    } catch (err) {
      console.error(
        "GET /order/user/:userId failed:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to fetch orders.",
      });
    }
  }
);


// ============================================================
// UPDATE ORDER STATUS
// ADMIN ONLY
// ============================================================

router.put(
  "/:id/status",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(
          req.params.id
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid order id.",
        });
      }


      const requestedStatus =
        String(
          req.body.status || ""
        ).toLowerCase();


      if (
        !ORDER_STATUSES.includes(
          requestedStatus
        )
      ) {
        return res.status(400).json({
          message:
            `Invalid order status. Must be one of: ${ORDER_STATUSES.join(
              ", "
            )}.`,
        });
      }


      const order =
        await Order.findById(
          req.params.id
        );


      if (!order) {
        return res.status(404).json({
          message:
            "Order not found.",
        });
      }


      // --------------------------------------------------------
      // Prevent cancelled orders from being restored
      // --------------------------------------------------------

      if (
        order.status === "cancelled" &&
        requestedStatus !== "cancelled"
      ) {
        return res.status(400).json({
          message:
            "A cancelled order cannot be restored.",
        });
      }


      order.status =
        requestedStatus;

      await order.save();


      // --------------------------------------------------------
      // Update related schedule
      // --------------------------------------------------------

      const scheduleStatus =
        ORDER_TO_SCHEDULE_STATUS[
          order.status
        ] || "pending";


      await Schedule.findOneAndUpdate(
        {
          orderId: order._id,
        },
        {
          $set: {
            status:
              scheduleStatus,
          },
        }
      );


      return res.status(200).json(
        order
      );
    } catch (err) {
      console.error(
        "PUT /order/:id/status failed:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to update order status.",
      });
    }
  }
);


// ============================================================
// UPDATE DELIVERY STATUS
// ADMIN ONLY
// ============================================================

router.put(
  "/:id/delivery-status",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      // --------------------------------------------------------
      // Validate order ID
      // --------------------------------------------------------

      if (
        !mongoose.isValidObjectId(
          req.params.id
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid order id.",
        });
      }


      // --------------------------------------------------------
      // Validate delivery status
      // --------------------------------------------------------

      const deliveryStatus =
        String(
          req.body.deliveryStatus || ""
        ).toLowerCase();


      if (
        !DELIVERY_PROGRESSION.includes(
          deliveryStatus
        )
      ) {
        return res.status(400).json({
          message:
            `Invalid delivery status. Must be one of: ${DELIVERY_PROGRESSION.join(
              ", "
            )}.`,
        });
      }


      // --------------------------------------------------------
      // Find order
      // --------------------------------------------------------

      const order =
        await Order.findById(
          req.params.id
        );


      if (!order) {
        return res.status(404).json({
          message:
            "Order not found.",
        });
      }


      // --------------------------------------------------------
      // Prevent cancelled orders from being delivered
      // --------------------------------------------------------

      if (
        order.status === "cancelled"
      ) {
        return res.status(400).json({
          message:
            "A cancelled order cannot be delivered.",
        });
      }


      // --------------------------------------------------------
      // Current delivery status
      // --------------------------------------------------------

      const currentStatus =
        order.deliveryStatus ||
        "processing";


      const currentIndex =
        DELIVERY_PROGRESSION.indexOf(
          currentStatus
        );


      const newIndex =
        DELIVERY_PROGRESSION.indexOf(
          deliveryStatus
        );


      // --------------------------------------------------------
      // Protect against invalid existing database status
      // --------------------------------------------------------

      if (currentIndex === -1) {
        return res.status(500).json({
          message:
            "Order has an invalid delivery status.",
        });
      }


      // --------------------------------------------------------
      // Prevent backwards movement
      // --------------------------------------------------------

      if (
        newIndex < currentIndex
      ) {
        return res.status(400).json({
          message:
            "Delivery status cannot move backwards.",
        });
      }


      // --------------------------------------------------------
      // No change
      // --------------------------------------------------------

      if (
        newIndex === currentIndex
      ) {
        return res.status(200).json({
          message:
            "Delivery status is already set.",
          order,
        });
      }


      // --------------------------------------------------------
      // Record timestamp
      // --------------------------------------------------------

      const now = new Date();


      order.deliveryStatus =
        deliveryStatus;


      if (
        deliveryStatus ===
          "shipped" &&
        !order.shippedAt
      ) {
        order.shippedAt =
          now;
      }


      if (
        deliveryStatus ===
          "out_for_delivery" &&
        !order.outForDeliveryAt
      ) {
        order.outForDeliveryAt =
          now;
      }


      if (
        deliveryStatus ===
          "delivered" &&
        !order.deliveredAt
      ) {
        order.deliveredAt =
          now;
      }


      await order.save();


      // --------------------------------------------------------
      // Update schedule when delivered
      // --------------------------------------------------------

      const scheduleStatus =
        DELIVERY_TO_SCHEDULE_STATUS[
          deliveryStatus
        ];


      if (scheduleStatus) {
        await Schedule.findOneAndUpdate(
          {
            orderId:
              order._id,
          },
          {
            $set: {
              status:
                scheduleStatus,
            },
          }
        );
      }


      // --------------------------------------------------------
      // Create + send customer notification, and a matching email
      // --------------------------------------------------------

      const notificationText =
        DELIVERY_MESSAGES[
          deliveryStatus
        ];


      if (notificationText) {
        try {
          const notification =
            await createNotification({
              senderId:
                req.auth.id,

              senderModel:
                "Staff",

              receiverId:
                order.customerId,

              receiverModel:
                "User",

              type:
                "delivery",

              text:
                notificationText,

              link:
                `/schedule`,

              actionId:
                String(
                  order._id
                ),
            });

          // Send persisted notification
          // to connected customer sockets.
          sendNotification(
            order.customerId,
            notification
          );
        } catch (
          notificationError
        ) {
          // Notification failure must NOT
          // undo the successful delivery update.
          console.error(
            "Failed to create/send delivery notification:",
            notificationError
          );
        }

        // Email is a separate, independent side effect from the in-app
        // notification above — its own try/catch so a failed send can
        // never undo the delivery update or suppress the notification.
        try {
          if (order.contact?.email) {
            const { subject, html } = deliveryUpdateEmail({
              customerName: order.contact?.name,
              message: notificationText,
              orderItems: order.items,
            });

            await sendEmail({
              to: order.contact.email,
              subject,
              html,
            });
          }
        } catch (emailErr) {
          console.error(
            "Delivery update email failed:",
            emailErr
          );
        }
      }


      // --------------------------------------------------------
      // Response
      // --------------------------------------------------------

      return res.status(200).json({
        message:
          "Delivery status updated successfully.",

        order,
      });
    } catch (err) {
      console.error(
        "PUT /order/:id/delivery-status failed:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to update delivery status.",
      });
    }
  }
);


// ============================================================
// DELETE ORDER
// ADMIN ONLY
// ============================================================

router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      if (
        !mongoose.isValidObjectId(
          req.params.id
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid order id.",
        });
      }


      const deleted =
        await Order.findByIdAndDelete(
          req.params.id
        );


      if (!deleted) {
        return res.status(404).json({
          message:
            "Order not found.",
        });
      }


      await Schedule.findOneAndDelete({
        orderId:
          req.params.id,
      });


      return res.status(200).json({
        message:
          "Order deleted.",
      });
    } catch (err) {
      console.error(
        "DELETE /order/:id failed:",
        err
      );

      return res.status(500).json({
        message:
          "Failed to delete order.",
      });
    }
  }
);


module.exports = router;