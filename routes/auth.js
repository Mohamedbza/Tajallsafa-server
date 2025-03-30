const express = require("express");
const bcryptjs = require("bcryptjs");
const Client = require("../models/client");
const authRouter = express.Router();
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");  
const nodemailer = require('nodemailer');
const authMiddleware = require("../middleware/auth");
const mongoose = require("mongoose");
// Signup route
authRouter.post("/signup", async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;
    if (!username || !email || !phone || !password ) {
      return res.status(400).json({ msg: "!يرجى ملئ جميع الخانات" });
    }

    // Check if the phone number is already in use
    const existingClientByPhone = await Client.findOne({ phone });
    if (existingClientByPhone) {
      return res.status(400).json({ msg: "!عميل بنفس رقم الهاتف موجود بالفعل" });
    }

    // Hash the password
    const hashedPassword = await bcryptjs.hash(password, 6);

    // Create a new Client
    let client = new Client({
      phone,
      password: hashedPassword,
      username,
      email,
    });

    // Add a welcome notification
    client.notifications.push({
      title: ': مرحبا بك عزيزي العميل',
      message: `.يرجى تفعيل حسابك للتمكن من استخدام التطبيق بشكل كامل`,
      createdAt: new Date(),
    });

    // Save the new client to the database
    client = await client.save();
    res.json(client);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Sign In route
authRouter.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ msg: "يرجى ملئ خانتي البريد الإلكتروني وكلمة السر" });
    }
    const client = await Client.findOne({ email });
    if (!client) {
      return res
        .status(400)
        .json({ msg: "لا يوجد عميل يحمل هذا البريد الإلكتروني" });
    }
    const isMatch = await bcryptjs.compare(password, client.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "كلمة السر خاطئة" });
    }
    const token = jwt.sign(
      { id: client._id },  // ✅ Ensure `id` is present in the payload
      process.env.JWT_SECRET,
      { expiresIn: "7d" }  // Optional: Token expires in 7 days
    );
    res.header("x-auth-token", token);
    res.json({ token, ...client._doc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// Updated tokenIsValid endpoint
authRouter.post('/tokenIsValid', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json(false);

    // Verify token structure first
    const decoded = jwt.decode(token);
    if (!decoded?.id) return res.status(401).json(false);

    // Then verify signature and expiration
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user exists
    const client = await Client.findById(verified.id).select('-password');
    if (!client) return res.status(401).json(false);

    // Return minimal client data if needed
    res.status(200).json({
      isValid: true,
      client: {
        id: client._id,
        clientname: client.client,
        email: client.email
      }
    });
  } catch (err) {
    console.error('Token validation error:', err);
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Server error during token validation' });
  }
});
// Fetch user data
authRouter.get('/client', authMiddleware, async (req, res) => {
  try {
    console.log("Received token:", req.header('x-auth-token')); // Debug token
    console.log("Authenticated user ID:", req.user._id); // Debug user
    
    const client = await Client.findById(req.user._id).select('-password');
    if (!client) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log("Returning client data:", client); // Debug response
    res.json(client);
  } catch (err) {
    console.error("Error in /client:", err); // Critical debug
    res.status(500).json({ error: err.message });
  }
});
  // Update client information: username, phone and email
  authRouter.put('/:clientid/updateClient', async (req, res) => {
    const { username, email, phone } = req.body;
    const clientId = req.params.clientid; // Get client ID from URL

    // Validate required fields
    if (!username || !email || !phone) {
        return res.status(400).json({ msg: 'Please provide username, email, and phone.' });
    }

    try {
        // Find client by ID
        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ msg: 'Client not found.' });
        }

        // Check if the phone number is used by another client
        if (client.phone !== phone) {
            const existingClient = await Client.findOne({ phone });
            if (existingClient && existingClient._id.toString() !== clientId) {
                return res.status(400).json({ msg: 'Phone number already in use.' });
            }
        }

        // Update client details
        client.username = username;
        client.email = email;
        client.phone = phone;

        // Save changes
        await client.save();
        
        res.status(200).json({ msg: 'Client information updated successfully.', client });
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
});
authRouter.put('/:clientId/updatePassword', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const clientId = req.params.clientId;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: "Current and new password required" });
    }

    // Find client WITH password field
    const client = await Client.findById(clientId).select('+password');
    if (!client) {
      return res.status(404).json({ msg: "Client not found" });
    }

    // Verify current password
    const isMatch = await bcryptjs.compare(currentPassword, client.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Current password is incorrect" });
    }

    // Hash and save new password
    client.password = await bcryptjs.hash(newPassword, 6);
    await client.save();

    // Return success without password
    client.password = undefined;
    res.json({ msg: "Password updated successfully", client });
    
  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = authRouter;
