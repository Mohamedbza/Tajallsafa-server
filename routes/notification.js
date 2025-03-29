const express = require('express');
const notificationrouter = express.Router();
const Client = require('../models/client'); // Update the path as needed

 
notificationrouter.get('/clients/:clientId/notifications', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Find the client by ID
    const client = await Client.findById(clientId);

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Return the notifications array
    res.status(200).json(client.notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});
// DELETE route to delete a notification
// Add this to your routes
notificationrouter.delete('/clients/:clientId/notifications', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Find client
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).send('Client not found');
    }

    // Clear all notifications
    client.notifications = [];
    await client.save();

    res.status(200).send('All notifications deleted');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});



module.exports = notificationrouter;
