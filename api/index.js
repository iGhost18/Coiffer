require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const http = require("http");
const cookieParser = require("cookie-parser");

const userRoute = require("./routes/user");
const authRoute = require("./routes/auth");
const postRoute = require("./routes/post");
const inviteRoute = require("./routes/invite");
const staffRoute = require("./routes/staff");
const uploadRoute = require("./routes/upload");
const conversationRoute = require("./routes/conversation");
const messageRoute = require("./routes/message");
const servicesRoute = require("./routes/services");
const servicedetailRoute = require("./routes/servicedetail");
const bookingRoute = require("./routes/booking");
const orderRoute = require("./routes/order");
const paymentRoute = require("./routes/payment");
const scheduleRoute = require("./routes/schedule");
const cartRoute = require("./routes/cart");
const notificationRoute = require("./routes/notification");
const homepageServiceRoute = require("./routes/homepageService");
const productRoute = require("./routes/product");
const storyRoute = require("./routes/story");
const ratingRoute = require("./routes/rating");
const bookingPayoutRoutes = require("./routes/bookingPayout");


const rateLimit = require("./middleware/rateLimit");
const { initializeSocket } = require("./socket");

const cron = require("node-cron");
const { runAutoReleaseSweep } = require("./jobs/autoReleasePayouts");
cron.schedule("*/15 * * * *", runAutoReleaseSweep);

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 8016;
const HOST = process.env.HOST || "0.0.0.0";

if (!process.env.MONGO_URL || !process.env.JWT_SECRET) {
    console.error(
        "Missing required MONGO_URL or JWT_SECRET environment variable."
    );
    process.exit(1);
}

// Fail fast on boot rather than failing silently the first time a customer
// tries to pay or upload something in production. This replaces the old
// standalone CLIENT_URL-only check with the full list this app depends on.
if (process.env.NODE_ENV === "production") {
    const requiredInProduction = [
        "CLIENT_URL",
        "FLW_SECRET_KEY",
        "FLW_WEBHOOK_SECRET_HASH",
        "FLW_REDIRECT_URL",
        "CLOUDINARY_URL",
    ];

    const missing = requiredInProduction.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        console.error(
            `Missing required environment variable(s) in production: ${missing.join(", ")}`
        );
        process.exit(1);
    }
}

/*
========================================
SOCKET.IO
========================================
*/
initializeSocket(server);

/*
========================================
SECURITY / REQUEST MIDDLEWARE
========================================
*/

app.use(
    helmet({
        crossOriginResourcePolicy: false,
    })
);

// Defense-in-depth: trust proxy is already set for req.secure to work
// correctly behind your load balancer, but this makes sure a plain HTTP
// request can never be served if it ever reaches the app directly (e.g.
// the platform's HTTP port isn't fully closed, or a misconfigured LB).
if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
        if (req.secure || req.headers["x-forwarded-proto"] === "https") {
            return next();
        }
        return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    });
}

const allowedOrigins = [
    process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(cookieParser());

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
  return obj;
};

app.use((req, res, next) => {
  sanitizeObject(req.body);
  sanitizeObject(req.params);
  if (req.query && typeof req.query === "object") {
    sanitizeObject(req.query);
  }

  next();
});

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "common"));

/*
========================================
RATE LIMITING
========================================
*/

app.use(
    rateLimit({
        windowMs: 60_000,
        max: 300,
    })
);

/*
========================================
HEALTH / READINESS
========================================
*/

app.get("/health", (req, res) => {
    const mongoReady =
        mongoose.connection.readyState === 1;

    if (!mongoReady) {
        return res.status(503).json({
            status: "unhealthy",
            database: "disconnected",
        });
    }

    return res.status(200).json({
        status: "ok",
        database: "connected",
        uptime: process.uptime(),
    });
});

/*
========================================
API ROUTES
========================================
*/

app.use("/api/staff", staffRoute);
app.use("/api/user", userRoute);

app.use(
    "/api/auth",
    rateLimit({
        windowMs: 15 * 60_000,
        max: 30,
    }),
    authRoute
);

app.use("/api/post", postRoute);
app.use("/api/invite", inviteRoute);

app.use(
    "/api/upload",
    rateLimit({
        windowMs: 60_000,
        max: 20,
    }),
    uploadRoute
);

app.use("/api/conversation", conversationRoute);
app.use("/api/message", messageRoute);
app.use("/api/services", servicesRoute);
app.use("/api/servicedetail", servicedetailRoute);
app.use("/api/booking", bookingRoute);
app.use("/api/order", orderRoute);
app.use("/api/payment", paymentRoute);
app.use("/api/schedule", scheduleRoute);
app.use("/api/cart", cartRoute);
app.use("/api/notification", notificationRoute);
app.use("/api/homepage-services", homepageServiceRoute);
app.use("/api/product", productRoute);
app.use("/api/story", storyRoute);
app.use("/api/rating", ratingRoute);
app.use("/api/booking-payout", bookingPayoutRoutes);
app.use("/api/invite-request", require("./routes/inviteRequest"));

/*
========================================
404 HANDLER
========================================
*/

app.use((req, res) => {
    res.status(404).json({
        message: "Route not found",
        path: req.originalUrl,
    });
});

/*
========================================
CENTRAL ERROR HANDLER
========================================
*/

app.use((err, req, res, next) => {

    if (res.headersSent) {
        return next(err);
    }
    console.error("Unhandled error:", err)
    const statusCode =
        Number.isInteger(err.statusCode) &&
        err.statusCode >= 400 &&
        err.statusCode < 600
            ? err.statusCode
            : 500;

    res.status(statusCode).json({
        message:
            process.env.NODE_ENV === "production"
                ? "Internal server error"
                : err.message || "Internal server error",
    });
});

/*
========================================
SERVER TIMEOUTS
========================================
*/

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

/*
========================================
DATABASE
========================================
*/

mongoose
    .connect(process.env.MONGO_URL, {
        serverSelectionTimeoutMS: 10_000,
    })
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((err) => {
        console.error("Error connecting to MongoDB:", err);
        process.exit(1);
    });

/*
========================================
SERVER
========================================
*/

const httpServer = server.listen(PORT, HOST, () => {
    console.log(`Server Running on ${HOST}:${PORT}`);
});

/*
========================================
GRACEFUL SHUTDOWN
========================================
*/

let shuttingDown = false;

const shutdown = async (signal) => {
    if (shuttingDown) return;

    shuttingDown = true;

    console.log(`${signal} received. Shutting down gracefully...`);

    const forceExitTimer = setTimeout(() => {
        console.error("Forced shutdown after timeout.");
        process.exit(1);
    }, 10_000);

    forceExitTimer.unref();

    httpServer.close(async () => {
        try {
            await mongoose.connection.close();
            console.log("MongoDB connection closed.");
            process.exit(0);
        } catch (error) {
            console.error("Error during shutdown:", error);
            process.exit(1);
        }
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));