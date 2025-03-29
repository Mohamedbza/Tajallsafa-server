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
    const client = await CLient.findById(verified.id).select('-password');
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
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
      const client = await Client.findOne({ email });
      if (!client) {
          return res.status(400).json({ msg: 'Client with this email does not exist!' });
      }

      // Generate a 6-digit reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const resetPasswordExpires = Date.now() + 10 * 60 * 1000; // Code valid for 10 minutes

      // Save reset code and expiry to the client
      client.resetPasswordToken = resetCode;
      client.resetPasswordExpires = resetPasswordExpires;
      await client.save();

      // Send reset code email
      const transporter = nodemailer.createTransport({
        host: 'smtp.businesstitans.pro', // Replace with your SMTP server address
        port: 465, // Use 587 if you're using TLS
        secure: true, // Use true for 465 (SSL), false for other ports (TLS)
        auth: {
          user: 'admin@businesstitans.pro', // Your Hostinger email address
          pass: 'Taherskikda21$', // Your Hostinger email password
        },
      });

      const mailOptions = {
          from: 'admin@businesstitans.pro',
          to: client.email,
          subject: 'طلب تغيير كلمة سر حساب بيزنس تايتنس',
          text: `لقد طلبت تغيير كلمة السر الخاصة بك, من فضلك استخدم هذا الرمز لتغيير كلمة السر الخاصة بك: ${resetCode}. هذا الرمز صالح لمدة 10 دقائق.`, // Arabic text explaining the reset code
      };

      await transporter.sendMail(mailOptions);

      res.status(200).json({ msg: 'Reset password code sent!' });
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
});

authRouter.post('/verify-reset-code', async (req, res) => {
  const { resetCode } = req.body; // Get reset code from request body

  try {
      // Find the client by the reset code and check if the reset code is still valid
      const client = await Client.findOne({
          resetPasswordToken: resetCode,
          resetPasswordExpires: { $gt: Date.now() }, // Ensure the code has not expired
      });

      if (!client) {
          return res.status(400).json({ msg: 'Invalid or expired reset code!' });
      }

      res.status(200).json({ msg: 'Reset code is valid!' });
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
});

authRouter.post('/reset-password', async (req, res) => {
  const { resetCode, password } = req.body; // Get resetCode and password from request body

  try {
      // Find the client by the reset code and check if the reset code is still valid
      const client = await Client.findOne({
          resetPasswordToken: resetCode,
          resetPasswordExpires: { $gt: Date.now() }, // Ensure the code has not expired
      });

      if (!client) {
          return res.status(400).json({ msg: 'Invalid or expired reset code!' });
      }

      // Hash the new password and save it
      const hashedPassword = await bcryptjs.hash(password, 6);
      client.password = hashedPassword;
      client.resetPasswordToken = undefined; // Clear the reset code and expiry
      client.resetPasswordExpires = undefined;
      await client.save();

      res.status(200).json({ msg: 'Password reset successful!' });
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
}); 

module.exports = authRouter;
