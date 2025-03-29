const express = require("express");
const bcryptjs = require("bcryptjs");
const Client = require("../models/client");
const authRouter = express.Router();
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");  
const nodemailer = require('nodemailer');
const authMiddleware = require("../middleware/auth");

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
    const token = jwt.sign({ id: client._id }, process.env.JWT_SECRET);
    res.header("x-auth-token", token);
    res.json({ token, ...client._doc });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Token validation route
authRouter.post("/tokenIsValid", async (req, res) => {
  try {
    const token = req.header("x-auth-token");
    if (!token) return res.json({ isValid: false });

    const verified = jwt.verify(token, "passwordKey");
    if (!verified) return res.json({ isValid: false });

    const client = await Client.findById(verified.id);
    if (!client) return res.json({ isValid: false });

    console.log('Client data:', client); // Debugging line
    res.json({ isValid: true, client });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



// Get user data
authRouter.get("/client", authMiddleware, async (req, res) => {
  try {
    // Get client ID from the authenticated token
    const clientId = req.user.id;

    // Fetch client data from the database
    const client = await Client.findById(clientId).select("-password"); // Exclude password for security

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    res.json(client); // Return client data
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
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
authRouter.put('/fix-children-arrays', async (req, res) => {
  try {
    // Find all clients
    const clients = await Client.find({ father: { $exists: true, $ne: null } });

    for (const client of clients) {
      const fatherId = client.father;

      // Find the father
      const father = await Client.findById(fatherId);

      if (father) {
        // Check if the client's ID is already in the father's children array
        if (!father.children.includes(client._id)) {
          // Add the client's ID to the father's children array
          father.children.push(client._id);
          await father.save();
        }
      } else {
        console.log(`Father with ID ${fatherId} not found for client ${client._id}`);
      }
    }

    res.status(200).json({ msg: "Children arrays have been fixed successfully." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

authRouter.post('/recalculate-earnings', async (req, res) => {
  try {
    await Client.recalculateAllEarnings();
    res.status(200).json({ message: 'Earnings recalculated for all clients successfully!' });
  } catch (error) {
    console.error('Error recalculating earnings:', error);
    res.status(500).json({ message: 'An error occurred while recalculating earnings.' });
  }
});


module.exports = authRouter;
