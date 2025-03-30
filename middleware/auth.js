const jwt = require("jsonwebtoken");
const Client = require("../models/client"); // Import your Client model
require("dotenv").config();

const auth = async (req, res, next) => {
  try {
    const token = req.header("x-auth-token");
    if (!token) {
      return res.status(401).json({ msg: "No auth token, access denied" });
    }

    // Verify token
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!verified?.id) {
      return res.status(401).json({ msg: "Invalid token structure." });
    }

    // Attach only the user ID to the request
    req.userId = verified.id;
    req.token = token;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    res.status(500).json({ error: "Server error: " + err.message });
  }
};

module.exports = auth;