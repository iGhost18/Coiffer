const Notification = require("../models/notification");
const mongoose = require("mongoose");

/**
 * Creates a notification internally.
 *
 * This is NOT exposed as a public API endpoint.
 * Only trusted backend code should call this function.
 */
async function createNotification({
  senderId,
  senderModel = "Staff",
  receiverId,
  receiverModel = "User",
  type,
  text,
  link = "",
  actionId = "",
}) {
  if (!mongoose.isValidObjectId(senderId)) {
    throw new Error("Invalid senderId");
  }

  if (!mongoose.isValidObjectId(receiverId)) {
    throw new Error("Invalid receiverId");
  }

  if (!type) {
    throw new Error("Notification type is required");
  }

  if (!text) {
    throw new Error("Notification text is required");
  }

  return Notification.create({
    senderId,
    senderModel,
    receiverId,
    receiverModel,
    type,
    text,
    link,
    actionId,
    isRead: false,
  });
}

module.exports = {
  createNotification,
};


