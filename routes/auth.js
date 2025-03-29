const express = require("express");
const bcryptjs = require("bcryptjs");
const Client = require("../models/client");
const authRouter = express.Router();
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const { v4: uuidv4 } = require("uuid");
const crypto = require('crypto');
const nodemailer = require('nodemailer');


// Function to ensure the custom ID is unique
const generateUniqueCustomId = async (username) => {
  // Get the first 3 letters from the username
  let prefix = username.slice(0, 3).toUpperCase();
  let customId;
  let unique = false;

  while (!unique) {
    // Generate a random alphanumeric string of length 7
    const randomPart = Array.from({ length: 3 }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))
    ).join('');

    // Combine the prefix and random part to form the custom ID
    customId = prefix + randomPart;

    // Check if the customId is already in use
    const existingClient = await Client.findOne({ _id: customId });

    if (!existingClient) {
      unique = true;
    }
  }

  return customId;
};


// Signup route
authRouter.post("/signup", async (req, res) => {
  try {
    const { username, email, phone, password, father } = req.body;
    if (!username || !email || !phone || !password || !father) {
      return res.status(400).json({ msg: "!يرجى ملئ جميع الخانات" });
    }

    // Log provided father ID for debugging
    console.log("Provided father ID:", father);

    // Generate a unique custom ID
    const customId = await generateUniqueCustomId(username, phone);

    // Check if the phone number is already in use
    const existingClientByPhone = await Client.findOne({ phone });
    if (existingClientByPhone) {
      return res.status(400).json({ msg: "!عميل بنفس رقم الهاتف موجود بالفعل" });
    }

    // Hash the password
    const hashedPassword = await bcryptjs.hash(password, 6);

    // Create a new client
    let client = new Client({
      _id: customId,
      phone,
      password: hashedPassword,
      username,
      email,
      father,
    });

    // Add a welcome notification
    client.notifications.push({
      title: ': مرحبا بك عزيزي العميل',
      message: `.يرجى تفعيل حسابك للتمكن من استخدام التطبيق بشكل كامل`,
      createdAt: new Date(),
    });

    // Verify the father ID exists in the database
    const parentClient = await Client.findById(father);
    if (!parentClient) {
      return res.status(400).json({ msg: "Invalid father ID" });
    }

    // Add the new client's ID to the father's children array
    parentClient.children.push(client._id);
    await parentClient.save();

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
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ msg: "يرجى ملئ خانتي رقم الهاتف و كلمة السر" });
    }
    const client = await Client.findOne({ phone });
    if (!client) {
      return res.status(400).json({ msg: "لا يوجد عميل يحمل هذالرقم " });
    }

    const isMatch = await bcryptjs.compare(password, client.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "كلمة السر خاطئة" });
    }

    const token = jwt.sign({ id: client._id }, "passwordKey");
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
authRouter.get("/", auth, async (req, res) => {
  const client = await Client.findById(req.client);
  res.json({ ...client._doc, token: req.token });
});

// Fetch all clients
authRouter.get("/clients", async (req, res) => {
  try {
    const clients = await Client.find({});
    res.json(clients);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
authRouter.delete("/clients/:id", async (req, res) => {
  try {
    const clientId = req.params.id;

    // Find and delete the client
    const client = await Client.findByIdAndDelete(clientId);

    if (!client) {
      return res.status(404).json({ msg: "Client not found" });
    }

    // If the client has a father, remove the client from the father's children list
    if (client.father) {
      await Client.findByIdAndUpdate(
        client.father,
        { $pull: { children: clientId } },
        { new: true }
      );
    }

    res.json({ msg: "Client deleted successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

authRouter.put('/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { activation } = req.body;

    if (activation !== true) {
      return res.status(400).json({ message: 'Invalid activation value. Must be true.' });
    }

    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(now.getFullYear() + 1);

    // Update the client activation status and push a new notification
    const client = await Client.findByIdAndUpdate(
      id,
      {
        activation: true,
        activationDate: now,
        activationExpires: oneYearLater,
        $push: {
          notifications: {
            title: ':التفعيل',
            message: 'لقد تم تفعيل حسابك بنجاح',
            createdAt: now,
          },
        },
      },
      { new: true, runValidators: true } // Return the updated document
    );

    if (!client) {
      return res.status(404).json({ message: 'Client not found.' });
    }

    res.status(200).json(client);
  } catch (error) {
    console.error('Error updating client activation:', error);
    res.status(500).json({ message: 'Server error. Unable to update client.' });
  }
});

 
authRouter.get('/clients/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({ msg: 'Client not found' });
    }

    res.json(client);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
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
