const mongoose = require("mongoose");
const Notification = require('./notification');
const clientSchema = new mongoose.Schema({ 
  token: {
    type: String,
  },
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: Number,
    required: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  creationDate: {
    type: Date,
    default: Date.now,
  },
  notifications: [Notification.schema],
  resetPasswordToken: {
    type: String,
},
resetPasswordExpires: {
    type: Date,
},
});
 
const Client = mongoose.model("Client", clientSchema);

module.exports = Client;