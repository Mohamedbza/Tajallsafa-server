const mongoose = require("mongoose"); 
const Notification = require('./notification'); 

// Freelancer Schema
const freelancerSchema = new mongoose.Schema({
 
  token: {
    type: String,
    default: null,
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
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  }, 
  profilePictureUrl: {
    type: String,
    default: null,
  }, 
  notifications: [Notification.schema], 
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  creationDate: {
    type: Date,
    default: Date.now,
  }, 
});
 

module.exports = {
  Freelancer: mongoose.model('Freelancer', freelancerSchema),
  Customer: mongoose.model('Customer', customerSchema),
};
