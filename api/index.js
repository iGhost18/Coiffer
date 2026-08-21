require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const http = require("http");

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
const scheduleRoute = require("./routes/schedule");
const cartRoute = require("./routes/cart");
const notificationRoute = require("./routes/notification");
const homepageServiceRoute = require("./routes/homepageService");
const productRoute = require("./routes/product");

const rateLimit = require("./middleware/rateLimit");
const { initializeSocket } = require("../socket");

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

if (process.env.NODE_ENV === "production" && !process.env.CLIENT_URL) {
    console.error(
        "Missing required CLIENT_URL environment variable in production."
    );
    process.exit(1);
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

app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        credentials: true,
    })
);

app.use(express.json({ limit: "1mb" }));

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
app.use("/api/schedule", scheduleRoute);
app.use("/api/cart", cartRoute);
app.use("/api/notification", notificationRoute);
app.use("/api/homepage-services", homepageServiceRoute);
app.use("/api/product", productRoute);

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
