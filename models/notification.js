const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: false },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
