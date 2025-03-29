const jwt = require("jsonwebtoken");
require("dotenv").config();

const auth = async (req, res, next) => {
  try {
    const token = req.header("x-auth-token");
    if (!token) {
      return res.status(401).json({ msg: "No auth token, access denied" });
    }

    const verified = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded Token:", verified);  // Debugging

    if (!verified || !verified.id) {
      return res.status(401).json({ msg: "Invalid token structure." });
    }

    req.client = String(verified.id);  
    req.token = token;
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    res.status(500).json({ error: "Server error: " + err.message });
  }
};

module.exports = auth;
