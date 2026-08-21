const jwt = require("jsonwebtoken");

const getToken = (req) => {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
};


const authenticate = (req, res, next) => {
  const token = getToken(req);

  if (!token) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    if (!decoded?.id || !decoded?.type) {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    if (!["User", "Staff"].includes(decoded.type)) {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    req.auth = {
      id: String(decoded.id),
      type: decoded.type,
      isAdmin: decoded.type === "Staff" && decoded.isAdmin === true,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.auth?.isAdmin) {
    return res.status(403).json({
      message: "Administrator access required.",
    });
  }

  next();
};

const requireSelf = (param = "id") => (req, res, next) => {
  if (!req.auth || String(req.auth.id) !== String(req.params[param])) {
    return res.status(403).json({
      message: "You can only access your own account.",
    });
  }

  next();
};

module.exports = {
  authenticate,
  requireAdmin,
  requireSelf,
};