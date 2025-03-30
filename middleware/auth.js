const jwt = require("jsonwebtoken");
const Client = require("../models/client");
require("dotenv").config();

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("x-auth-token");
    if (!token) return res.status(401).json({ msg: "No auth token, access denied" });

    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (!verified?.id) return res.status(401).json({ msg: "Invalid token structure" });

    // Only attach user ID to request
    req.userId = verified.id;
    req.token = token;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    res.status(500).json({ error: "Server error: " + err.message });
  }
};

module.exports = authMiddleware;