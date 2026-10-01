const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const Payment = require("../models/payment");
const Staff = require("../models/staff");
const Servicedetail = require("../models/servicedetail");
// ASSUMPTION: adjust this path/filename to match your actual Product model.
const Product = require("../models/product");
const { authenticate } = require("../middleware/auth");

const validate = require("../middleware/validate");
const rateLimit = require("../middleware/rateLimit");
const { checkoutSchema } = require("../validation/paymentSchemas");

const Booking = require("../models/booking");
const Order = require("../models/order");
const Schedule = require("../models/schedule");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const Notification = require("../models/notification");
const User = require("../models/user");
const sendEmail = require("../utils/sendEmail");
const {
  paymentReceiptEmail,
  bookingConfirmationEmail,
  newBookingNotificationEmail,
} = require("../utils/emailTemplates");
const { sendNotification, sendMessage } = require("../../socket/index");
const sendPushToOwner = require("../utils/sendPush");
const { durationToMinutes } = require("../utils/duration");

const { computeDeliveryWindow } = require("../utils/delivery");

/*
========================================
HELPERS
========================================
*/

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many checkout attempts. Please wait a moment and try again.",
});

const COMMISSION_RATE = 0.10;
const AUTO_RELEASE_WINDOW_MS = 24 * 60 * 60 * 1000;

function generateTxRef() {
  return `GC-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Same helper booking.js uses to build Schedule.date
function combineDateAndTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
}

// Constant-time string compare so webhook signature checking can't leak
// timing information about how many leading characters matched.
function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/*
========================================
CREATE FLUTTERWAVE PAYMENT
========================================

POST /api/payment/create

Money is collected into YOUR Flutterwave balance (no subaccount split).
Staff are paid later via the Transfers API once the job is confirmed.
*/

router.post("/create", checkoutLimiter, authenticate, validate(checkoutSchema), async (req, res) => {
  try {
    if (req.auth.type !== "User") {
      return res.status(403).json({ message: "Only customers can make payments." });
    }

    const { contact, address, cartItems, appointmentDate, appointmentTime } =
      req.validated.body;

    if (!contact?.name || !contact?.email || !contact?.phone) {
      return res.status(400).json({ message: "Complete contact information is required." });
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: "Your cart is empty." });
    }

    const rawServiceItems = cartItems.filter((item) => item.itemType === "service");
    const rawProductItems = cartItems.filter((item) => item.itemType === "product");

    if (rawServiceItems.length > 0 && (!appointmentDate || !appointmentTime)) {
      return res.status(400).json({ message: "Appointment date and time are required." });
    }

    /*
    AUTHORITATIVE PRICING — never trust price/name/duration from the client.
    */

    const serviceIds = rawServiceItems.map((item) => item.itemId || item.serviceId || item._id);
    const productIds = rawProductItems.map((item) => item.itemId || item.productId || item._id);

    const [serviceDetails, productDetails] = await Promise.all([
      serviceIds.length ? Servicedetail.find({ _id: { $in: serviceIds } }) : [],
      productIds.length ? Product.find({ _id: { $in: productIds } }) : [],
    ]);

    if (serviceDetails.length !== new Set(serviceIds.map(String)).size) {
      return res.status(400).json({ message: "One or more services could not be found." });
    }

    if (productDetails.length !== new Set(productIds.map(String)).size) {
      return res.status(400).json({ message: "One or more products could not be found." });
    }

    const serviceById = new Map(serviceDetails.map((d) => [d._id.toString(), d]));
    const productById = new Map(productDetails.map((d) => [d._id.toString(), d]));

    const serviceItems = rawServiceItems.map((item) => {
      const key = String(item.itemId || item.serviceId || item._id);
      const detail = serviceById.get(key);
      const quantity = Math.max(1, Math.min(20, Number(item.quantity) || 1));

      return {
        itemType: "service",
        itemId: detail._id,
        serviceDetailId: detail._id,
        staffId: item.staffId, // staff choice is a legitimate customer input, not a price field
        name: detail.name,
        price: detail.price,
        quantity,
        duration: detail.duration,
        img: detail.img,
      };
    });

    const productItems = rawProductItems.map((item) => {
      const key = String(item.itemId || item.productId || item._id);
      const detail = productById.get(key);
      const quantity = Math.max(1, Math.min(20, Number(item.quantity) || 1));

      return {
        itemType: "product",
        itemId: detail._id,
        name: detail.name,
        price: detail.price,
        quantity,
        img: detail.img,
      };
    });

    const authoritativeCartItems = [...serviceItems, ...productItems];

    const serviceTotal = roundMoney(
      serviceItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    );
    const productTotal = roundMoney(
      productItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    );
    const total = roundMoney(serviceTotal + productTotal);

    if (total <= 0) {
      return res.status(400).json({ message: "Invalid payment amount." });
    }

    /*
    COMMISSION — computed per staff member, stored on the Payment so
    finalizeSuccessfulPayment can snapshot it onto each Booking.
    */

    const staffPayouts = {};
    let platformCommission = 0;

    for (const item of serviceItems) {
      const staffId = item.staffId;

      if (!staffId) {
        return res.status(400).json({ message: `Service "${item.name}" has no staff member.` });
      }

      const amount = item.price * item.quantity;
      const commission = roundMoney(amount * COMMISSION_RATE);
      const payout = roundMoney(amount - commission);

      if (!staffPayouts[staffId]) {
        staffPayouts[staffId] = { gross: 0, commission: 0, payout: 0 };
      }

      staffPayouts[staffId].gross = roundMoney(staffPayouts[staffId].gross + amount);
      staffPayouts[staffId].commission = roundMoney(staffPayouts[staffId].commission + commission);
      staffPayouts[staffId].payout = roundMoney(staffPayouts[staffId].payout + payout);

      platformCommission = roundMoney(platformCommission + commission);
    }

    /*
    CHECK STAFF PAYOUT DETAILS — every staff member must have a verified
    bank account, otherwise we couldn't pay them later.
    */

    const staffIds = Object.keys(staffPayouts);

    if (staffIds.length > 0) {
      const staffMembers = await Staff.find({ _id: { $in: staffIds } }).select("_id flutterwave");

      for (const staffId of staffIds) {
        const staff = staffMembers.find((s) => String(s._id) === String(staffId));

        if (!staff) {
          return res.status(400).json({ message: "Staff member not found." });
        }

        if (!staff.flutterwave?.bankAccount?.account_number) {
          return res.status(400).json({
            message: "One of the barbers has not completed payout setup.",
          });
        }
      }
    }

    /*
    CREATE PAYMENT RECORD
    */

    const txRef = generateTxRef();

    const payment = await Payment.create({
      customerId: req.auth.id,
      txRef,
      amount: total,
      currency: "NGN",
      status: "pending",
      paymentMethod: "flutterwave",
      serviceTotal,
      productTotal,
      platformCommission,
      staffPayouts,
      checkoutData: {
        contact,
        address,
        cartItems: authoritativeCartItems,
        appointmentDate: appointmentDate || null,
        appointmentTime: appointmentTime || null,
      },
    });

    /*
    CREATE FLUTTERWAVE CHECKOUT (no subaccounts — funds stay in escrow)
    */

    const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: total,
        currency: "NGN",
        redirect_url: process.env.FLW_REDIRECT_URL,
        customer: {
          email: contact.email,
          name: contact.name,
          phonenumber: contact.phone,
        },
        customizations: {
          title: "GhostCutApp",
          description: "GhostCutApp payment",
        },
        meta: {
          paymentId: String(payment._id),
          customerId: String(req.auth.id),
        },
      }),
    });

    const data = await flutterwaveResponse.json();

    if (!flutterwaveResponse.ok || data.status !== "success") {
      console.error("Flutterwave create payment error:", data);
      await Payment.findByIdAndUpdate(payment._id, { status: "failed" });

      return res.status(502).json({
        message: data.message || "Unable to create Flutterwave payment.",
      });
    }

    return res.status(200).json({
      success: true,
      paymentId: payment._id,
      txRef,
      checkoutUrl: data.data.link,
    });
  } catch (error) {
    console.error("POST /api/payment/create failed:", error);
    return res.status(500).json({ message: "Payment initiation failed." });
  }
});

/*
========================================
BANKS + STAFF BANK ACCOUNT
========================================
*/

router.get("/banks", authenticate, async (req, res) => {
  try {
    const flwResponse = await fetch("https://api.flutterwave.com/v3/banks/NG", {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
    });
    const data = await flwResponse.json();

    if (!flwResponse.ok || data.status !== "success") {
      return res.status(502).json({ message: "Unable to load bank list." });
    }

    return res.status(200).json({ banks: data.data });
  } catch (error) {
    console.error("GET /api/payment/banks failed:", error);
    return res.status(500).json({ message: "Unable to load bank list." });
  }
});

/*
GET /api/payment/staff/bank-account
Returns the saved payout account, masked (never the full number).
*/
router.get("/staff/bank-account", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "Staff") {
      return res.status(403).json({ message: "Only staff can view payout details." });
    }

    const staff = await Staff.findById(req.auth.id).select("flutterwave.bankAccount");
    const bank = staff?.flutterwave?.bankAccount;

    if (!bank?.account_number) {
      return res.status(200).json({ bankAccount: null });
    }

    return res.status(200).json({
      bankAccount: {
        account_name: bank.account_name,
        account_bank: bank.account_bank,
        last4: String(bank.account_number).slice(-4),
      },
    });
  } catch (error) {
    console.error("GET /api/payment/staff/bank-account failed:", error);
    return res.status(500).json({ message: "Unable to load payout details." });
  }
});

/*
POST /api/payment/staff/bank-account
Replaces the old create-subaccount route. Verifies the account with
Flutterwave first so staff can't be paid to a mistyped account.
*/
router.post("/staff/bank-account", authenticate, async (req, res) => {
  try {
    if (req.auth.type !== "Staff") {
      return res.status(403).json({ message: "Only staff can set up payouts." });
    }

    const { account_bank, account_number } = req.body;

    if (!account_bank || !account_number) {
      return res.status(400).json({ message: "Bank and account number are required." });
    }

    const resolveRes = await fetch("https://api.flutterwave.com/v3/accounts/resolve", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ account_number, account_bank }),
    });

    const resolved = await resolveRes.json();

    if (!resolveRes.ok || resolved.status !== "success") {
      return res.status(400).json({ message: "Could not verify that bank account." });
    }

    await Staff.findByIdAndUpdate(req.auth.id, {
      "flutterwave.bankAccount": {
        account_bank: String(account_bank),
        account_number: String(account_number),
        account_name: resolved.data.account_name,
      },
    });

    return res.status(200).json({
      success: true,
      account_name: resolved.data.account_name,
    });
  } catch (error) {
    console.error("POST /api/payment/staff/bank-account failed:", error);
    return res.status(500).json({ message: "Payout setup failed." });
  }
});

/*
========================================
SHARED: turn a verified payment into
Bookings/Orders + messaging/notifications.

Used by BOTH /verify and /webhook. Idempotent and race-safe via the
atomic findOneAndUpdate claim below.

Every booking created here starts in escrow: payoutStatus "held".
========================================
*/

async function finalizeSuccessfulPayment(payment, tx) {
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "successful" } },
    {
      $set: {
        status: "successful",
        flutterwaveTransactionId: tx.id,
        verifiedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!claimed) {
    const [bookings, orders] = await Promise.all([
      Booking.find({ paymentId: payment._id }),
      Order.find({ paymentId: payment._id }),
    ]);
    return { payment, bookings, orders, alreadyProcessed: true };
  }

  const { contact, address, cartItems, appointmentDate, appointmentTime } = claimed.checkoutData;

  const createdBookings = [];
  const createdOrders = [];

  const serviceItems = cartItems.filter((i) => i.itemType === "service");
  const productItems = cartItems.filter((i) => i.itemType === "product");

  const byStaff = {};
  for (const item of serviceItems) {
    if (!byStaff[item.staffId]) byStaff[item.staffId] = [];
    byStaff[item.staffId].push(item);
  }

  const sender = await User.findById(claimed.customerId);

  try {
    for (const [staffId, items] of Object.entries(byStaff)) {
      const bookingTotal = roundMoney(
        items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0)
      );

      // Auto-release window: appointment start + total service time + 24h.
      const totalMinutes = items.reduce(
        (sum, i) => sum + durationToMinutes(i.duration) * Math.max(1, Number(i.quantity) || 1),
        0
      );
      const autoReleaseAt = new Date(
        combineDateAndTime(appointmentDate, appointmentTime).getTime() +
          totalMinutes * 60 * 1000 +
          AUTO_RELEASE_WINDOW_MS
      );

      const booking = await Booking.create({
        customerId: claimed.customerId,
        staffId,
        contact,
        services: items.map((i) => ({
          serviceDetailId: i.serviceDetailId || i.itemId,
          name: i.name,
          price: i.price,
          quantity: i.quantity || 1,
          duration: i.duration,
          img: i.img,
        })),
        appointmentDate,
        appointmentTime,
        address,
        paymentMethod: "Flutterwave",
        paymentId: claimed._id,
        total: bookingTotal,
        status: "pending",

        // escrow
        payoutStatus: "held",
        staffPayoutAmount: claimed.staffPayouts?.[staffId]?.payout || 0,
        autoReleaseAt,
      });

      createdBookings.push(booking);

      await Schedule.create({
        type: "appointment",
        bookingId: booking._id,
        userId: booking.customerId,
        staffId: booking.staffId,
        title: booking.services.map((s) => s.name).join(", "),
        subtitle: booking.paymentMethod,
        date: combineDateAndTime(appointmentDate, appointmentTime),
        status: "pending",
        amount: booking.total,
      });

      const receiver = await Staff.findById(staffId);

      try {
        if (receiver?.email) {
          const { subject, html, text } = newBookingNotificationEmail({
            staffName: receiver.displayName || receiver.username,
            customerName: contact?.name,
            services: booking.services,
            appointmentDate,
            appointmentTime: booking.appointmentTime,
            total: booking.total,
          });
          await sendEmail({ to: receiver.email, subject, html, text });
        }
      } catch (emailErr) {
        console.error("Staff booking notification email failed:", emailErr);
      }

      try {
        await sendPushToOwner(staffId, "Staff", {
          title: "New booking request",
          body: `${contact?.name || "A customer"} requested an appointment.`,
          url: "/messenger",
        });
      } catch (pushErr) {
        console.error("Push notification failed:", pushErr);
      }

      if (sender && receiver) {
        let conversation = await Conversation.findOne({
          members: { $all: [sender._id.toString(), receiver._id.toString()] },
        });

        if (!conversation) {
          conversation = await Conversation.create({
            members: [sender._id.toString(), receiver._id.toString()],
          });
        }

        const bookingMessage = await Message.create({
          sender: sender._id.toString(),
          conversationId: conversation._id.toString(),
          type: "booking",
          bookingId: booking._id,
          status: "pending",
          text: `${sender.username} requested an appointment`,
        });

        const populatedBookingMessage = await Message.findById(bookingMessage._id).populate({
          path: "bookingId",
          select:
            "services appointmentDate appointmentTime address paymentMethod total contact status customerId staffId payoutStatus customerConfirmedAt staffConfirmedAt autoReleaseAt",
          populate: [
            { path: "customerId", select: "username profilePicture" },
            { path: "staffId", select: "username profilePicture location workType" },
          ],
        });

        sendMessage(receiver._id.toString(), populatedBookingMessage);

        const notification = await Notification.create({
          senderId: sender._id,
          senderModel: "User",
          receiverId: receiver._id,
          receiverModel: "Staff",
          type: "booking",
          bookingId: booking._id,
          text: `${sender.username} booked an appointment.`,
          link: "/messenger",
        });

        const populatedNotification = await Notification.findById(notification._id).populate(
          "senderId",
          "username profilePicture"
        );

        sendNotification(receiver._id.toString(), populatedNotification);
      }
    }

    if (productItems.length > 0) {
      const orderTotal = roundMoney(
        productItems.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0)
      );

      const { estimatedDeliveryStart, estimatedDeliveryEnd } = computeDeliveryWindow(address);

      const order = await Order.create({
        customerId: claimed.customerId,
        contact,
        items: productItems.map((i) => ({
          itemId: String(i.itemId),
          name: i.name,
          price: i.price,
          quantity: i.quantity || 1,
          img: i.img,
        })),
        address,
        paymentMethod: "Flutterwave",
        paymentId: claimed._id,
        total: orderTotal,
        status: "pending",
        deliveryStatus: "processing",
        estimatedDeliveryStart,
        estimatedDeliveryEnd,
      });

      createdOrders.push(order);

      await Schedule.create({
        type: "order",
        orderId: order._id,
        userId: order.customerId,
        staffId: null,
        title: order.items.map((i) => i.name).join(", "),
        subtitle: order.paymentMethod,
        date: new Date(),
        status: "pending",
        amount: order.total,
      });
    }

    // Keep the Payment -> Booking/Order links populated.
    await Payment.updateOne(
      { _id: claimed._id },
      {
        $set: {
          bookingIds: createdBookings.map((b) => b._id),
          orderId: createdOrders[0]?._id || null,
        },
      }
    );
  } catch (createErr) {
    if (createErr.code === 11000) {
      const err = new Error("SLOT_TAKEN");
      err.isSlotTaken = true;
      throw err;
    }
    throw createErr;
  }

  // Emails are best-effort — a failed send must never undo a successful payment.
  try {
    if (contact?.email) {
      for (const booking of createdBookings) {
        const staffDoc = await Staff.findById(booking.staffId).select("displayName username");
        const { subject, html, text } = bookingConfirmationEmail({
          customerName: contact.name,
          staffName: staffDoc?.displayName || staffDoc?.username,
          services: booking.services,
          appointmentDate,
          appointmentTime: booking.appointmentTime,
          total: booking.total,
          reference: booking._id.toString().slice(-8).toUpperCase(),
        });
        await sendEmail({ to: contact.email, subject, html, text });
      }

      for (const order of createdOrders) {
        const { subject, html } = paymentReceiptEmail({
          customerName: contact.name,
          txRef: claimed.txRef,
          total: order.total,
          items: order.items,
        });
        await sendEmail({ to: contact.email, subject, html });
      }
    }
  } catch (emailErr) {
    console.error("Payment confirmation email(s) failed:", emailErr);
  }

  return { payment: claimed, bookings: createdBookings, orders: createdOrders, alreadyProcessed: false };
}

/*
========================================
VERIFY TRANSACTION
========================================

GET /api/payment/verify/:transactionId
*/

router.get("/verify/:transactionId", authenticate, async (req, res) => {
  try {
    const { transactionId } = req.params;

    const flwResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );

    const data = await flwResponse.json();

    if (!flwResponse.ok || data.status !== "success") {
      return res.status(502).json({ message: data.message || "Unable to verify transaction." });
    }

    const tx = data.data;
    const payment = await Payment.findOne({ txRef: tx.tx_ref });

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found." });
    }

    const isOwner = req.auth.type === "User" && String(payment.customerId) === req.auth.id;

    if (!isOwner && !req.auth.isAdmin) {
      return res.status(403).json({ message: "Access denied." });
    }

    const amountMatches = roundMoney(tx.amount) === roundMoney(payment.amount);
    const currencyMatches = tx.currency === payment.currency;

    if (tx.status !== "successful" || !amountMatches || !currencyMatches) {
      if (payment.status !== "successful") {
        payment.status = "failed";
        await payment.save();
      }
      return res.status(200).json({ success: false, message: "Transaction could not be verified." });
    }

    let result;
    try {
      result = await finalizeSuccessfulPayment(payment, tx);
    } catch (err) {
      if (err.isSlotTaken) {
        return res.status(409).json({
          success: false,
          message: "That appointment slot was just taken. Please choose a different time.",
        });
      }
      throw err;
    }

    const { contact, address } = payment.checkoutData;

    return res.status(200).json({
      success: true,
      paymentId: result.payment._id,
      txRef: result.payment.txRef,
      bookings: result.bookings,
      orders: result.orders,
      contact,
      address,
      paymentMethod: "Flutterwave",
      total: result.payment.amount,
    });
  } catch (error) {
    console.error("GET /api/payment/verify failed:", error);
    return res.status(500).json({ message: "Verification failed." });
  }
});

/*
========================================
WEBHOOK
========================================

Handles two kinds of events:
  - transfer.completed : final result of a staff payout
  - everything else    : charge confirmation (re-verified against Flutterwave)
*/

router.post("/webhook", async (req, res) => {
  try {
    const secretHash = process.env.FLW_WEBHOOK_SECRET_HASH;
    const signature = req.headers["verif-hash"];

    if (!secretHash || !signature || !timingSafeEqualStrings(signature, secretHash)) {
      return res.status(401).end();
    }

    const payload = req.body;

    /*
    PAYOUT RESULT — must be handled BEFORE the charge logic, because a
    transfer's data.id is a transfer id, not a transaction id.
    */
    if (String(payload?.event || "").startsWith("transfer")) {
      const reference = payload?.data?.reference;
      const status = String(payload?.data?.status || "").toUpperCase();

      if (reference && status === "FAILED") {
        await Booking.updateOne(
          { transferReference: reference },
          { $set: { payoutStatus: "payout_failed" } }
        );
        console.error("Payout transfer FAILED for reference", reference);
        // TODO: alert admin — this booking needs a retry via /admin/:id/retry-payout
      }

      return res.status(200).end();
    }

    const transactionId = payload?.data?.id;

    if (!transactionId) {
      return res.status(400).end();
    }

    // Re-fetch from Flutterwave — never trust amount/status in the webhook body.
    const flwResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );

    const data = await flwResponse.json();

    if (!flwResponse.ok || data.status !== "success") {
      console.error("Webhook: Flutterwave verify failed:", data);
      return res.status(200).end();
    }

    const tx = data.data;
    const payment = await Payment.findOne({ txRef: tx.tx_ref });

    if (!payment) {
      console.error("Webhook: no Payment record for txRef", tx.tx_ref);
      return res.status(200).end();
    }

    const amountMatches = roundMoney(tx.amount) === roundMoney(payment.amount);
    const currencyMatches = tx.currency === payment.currency;

    if (tx.status !== "successful" || !amountMatches || !currencyMatches) {
      if (payment.status !== "successful") {
        payment.status = "failed";
        await payment.save();
      }
      return res.status(200).end();
    }

    try {
      await finalizeSuccessfulPayment(payment, tx);
    } catch (err) {
      if (!err.isSlotTaken) {
        console.error("Webhook: finalize failed:", err);
        return res.status(500).end(); // let Flutterwave retry
      }
      // Slot taken between payment and processing: needs a manual refund/reschedule.
      console.error("Webhook: slot taken for payment", payment._id);
    }

    return res.status(200).end();
  } catch (error) {
    console.error("Flutterwave webhook error:", error);
    return res.status(500).end();
  }
});

module.exports = router;