const jwt = require("jsonwebtoken");
require("dotenv").config();

const auth = async (req, res, next) => {
  try {
    const token = req.header("x-auth-token");
    
    if (!token) {
      return res.status(401).json({ msg: "No auth token, access denied" });
    }

    // Debugging: Log the token and secret key (DON'T DO THIS IN PRODUCTION)
    console.log("Received Token:", token);
    console.log("JWT Secret:", process.env.JWT_SECRET ? "Loaded ✅" : "Not Loaded ❌");

    // Verify the token using the secret key
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (!verified) {
      return res.status(401).json({ msg: "Invalid token, authorization denied." });
    }

    // Attach user data to request object
    req.client = verified; // Now you have access to { id, iat, exp }
    req.token = token;

    next(); // Proceed to the next middleware
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    
    // Check for specific JWT errors
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ msg: "Invalid token signature." });
    } else if (err.name === "TokenExpiredError") {
      return res.status(401).json({ msg: "Token has expired, please login again." });
    }

    res.status(500).json({ error: "Server error: " + err.message });
  }
};

module.exports = auth;
