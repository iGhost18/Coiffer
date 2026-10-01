const jwt = require("jsonwebtoken");

const getToken = (req) => {
  const header = req.get("authorization");

  if (!header) {
    return null;
  }

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();

  return token || null;
};

const authenticate = (req, res, next) => {
  const token = getToken(req);

  if (!token) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        algorithms: ["HS256"],
      }
    );

    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof decoded.id !== "string" ||
      !decoded.id ||
      !["User", "Staff"].includes(decoded.type)
    ) {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    req.auth = {
      id: decoded.id,
      type: decoded.type,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    if (req.auth?.type !== "Staff") {
      return res.status(403).json({
        message: "Administrator access required.",
      });
    }

    const Staff = require("../models/staff");

    const staff = await Staff.findById(req.auth.id)
      .select("isAdmin")
      .lean();

    if (!staff || staff.isAdmin !== true) {
      return res.status(403).json({
        message: "Administrator access required.",
      });
    }

    next();
  } catch (error) {
    console.error("Admin authorization error:", error);

    return res.status(500).json({
      message: "Unable to verify administrator permissions.",
    });
  }
};

const requireSelf = (param = "id") => {
  return (req, res, next) => {
    if (
      !req.auth ||
      req.auth.id !== String(req.params[param])
    ) {
      return res.status(403).json({
        message: "You can only access your own account.",
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireAdmin,
  requireSelf,
};