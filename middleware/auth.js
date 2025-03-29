const jwt = require("jsonwebtoken");
const Client = require("../models/client"); // Import your Client model
require("dotenv").config();

const auth = async (req, res, next) => {
  try {
    const token = req.header("x-auth-token");
    if (!token) {
      return res.status(401).json({ msg: "No auth token, access denied" });
    }

    // 1. Verify token
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded Token:", verified);

    if (!verified?.id) {
      return res.status(401).json({ msg: "Invalid token structure." });
    }

    // 2. Fetch full client data
    const client = await Client.findById(verified.id).select("-password");
    if (!client) {
      return res.status(404).json({ msg: "Client not found" });
    }

    // 3. Attach full client object to req
    req.user = client; // Now routes can access req.user._id, req.user.username, etc.
    req.token = token;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    res.status(500).json({ error: "Server error: " + err.message });
  }
};

module.exports = auth;