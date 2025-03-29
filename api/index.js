require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const storage = multer.memoryStorage();
const authRouter = require("../routes/auth"); 
const { upload, uploadProfilePicture } = require('../routes/cloudinary'); 
const notificationrouter = require('../routes/notification'); 
const app = express();
const PORT = process.env.PORT || 3000;
app.use(bodyParser.json());
app.use(express.json());
app.use(cors());
const DB = process.env.MONGODB_URI;
// Connect to MongoDB
mongoose.connect(DB)
  .then(() => console.log('MongoDB connection successful'))
  .catch((e) => console.error('MongoDB connection error:', e));

// Routes
app.use('/api',authRouter);  
app.use('/api',notificationrouter); 
// Middleware to handle file uploads 

// API endpoint to upload profile picture
app.post('/api/upload-profile-picture',  upload.single('file'), uploadProfilePicture);

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
