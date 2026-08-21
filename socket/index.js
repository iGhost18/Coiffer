const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;
const users = new Map();
const messageRateLimits = new Map(); // senderId -> { windowStart, count }

const addUser = (userId, socketId) => {
  const key = String(userId);
  if (!users.has(key)) users.set(key, new Set());
  users.get(key).add(socketId);
};

const removeUser = (userId, socketId) => {
  const key = String(userId);
  const sockets = users.get(key);
  if (!sockets) return;
  sockets.delete(socketId);
  if (!sockets.size) users.delete(key);
};

const onlineUsers = () =>
  Array.from(users, ([userId, sockets]) => ({ userId, socketIds: Array.from(sockets) }));

const emitToUser = (userId, event, payload) => {
  if (!io) return;
  const sockets = users.get(String(userId));
  if (!sockets) return;
  for (const socketId of sockets) io.to(socketId).emit(event, payload);
};

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true },
    maxHttpBufferSize: 1e6,
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required."));

      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

      if (!decoded?.id || !decoded?.type) return next(new Error("Invalid authentication token."));
      socket.auth = {
        id: String(decoded.id),
        type: decoded.type,
        isAdmin: decoded.type === "Staff" && decoded.isAdmin === true,
      };
      next();
    } catch {
      next(new Error("Invalid or expired authentication token."));
    }
  });

  io.on("connection", (socket) => {
    addUser(socket.auth.id, socket.id);
    io.emit("getUsers", onlineUsers());

    socket.on("addUser", (userId) => {
      if (String(userId) !== socket.auth.id) return;
      addUser(socket.auth.id, socket.id);
      io.emit("getUsers", onlineUsers());
    });

    socket.on("requestOnlineUsers", () => socket.emit("getUsers", onlineUsers()));

    socket.on("sendMessage", ({ senderId, receiverId, text }) => {
      if (String(senderId) !== socket.auth.id) return;
      if (
        typeof receiverId !== "string" || !receiverId ||
        typeof text !== "string" || text.trim().length === 0 || text.length > 10000
      ) return;

      const now = Date.now();
      let limit = messageRateLimits.get(socket.auth.id);
      if (!limit || now - limit.windowStart >= 10000) {
        limit = { windowStart: now, count: 0 };
        messageRateLimits.set(socket.auth.id, limit);
      }
      if (++limit.count > 30) return;

      emitToUser(receiverId, "getMessage", {
        senderId: socket.auth.id,
        text,
      });
    });

    socket.on("disconnect", () => {
      removeUser(socket.auth.id, socket.id);
      io.emit("getUsers", onlineUsers());
      // rate-limit entries are cheap to keep; they self-expire on next message after 10s
    });
  });

  return io;
};

const sendNotification = (receiverId, notification) =>
  emitToUser(receiverId, "getNotification", notification);

const sendMessage = (receiverId, message) =>
  emitToUser(receiverId, "getMessage", message);

const sendMessageUpdate = (receiverId, statusUpdate) =>
  emitToUser(receiverId, "getMessageUpdate", statusUpdate);

const sendHomepageServiceUpdate = (action, service) => {
  if (io) io.emit("homepageServiceUpdate", { action, service });
};

module.exports = {
  initializeSocket,
  sendNotification,
  sendMessage,
  sendMessageUpdate,
  sendHomepageServiceUpdate,
  onlineUsers,
};