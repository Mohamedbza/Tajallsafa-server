const { v2: cloudinary } = require('cloudinary');
const dotenv = require('dotenv');
const multer = require('multer');
const Client = require('../models/client'); // Fixed import (lowercase 'client')

// Load environment variables
dotenv.config();

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET_KEY,
});

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to extract public_id
function extractPublicId(imageUrl) {
  if (!imageUrl) return null;
  const parts = imageUrl.split('/');
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex === -1 || uploadIndex >= parts.length - 1) return null;
  return parts[uploadIndex + 1].split('.')[0];
}

// Upload profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const clientId = req.body.clientId;
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    // Find client - note the lowercase 'client'
    const client = await Client.findOne({ _id: clientId }); // Changed to uppercase 'Client'
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Delete old image if exists
    if (client.profilePictureUrl) {
      const oldPublicId = extractPublicId(client.profilePictureUrl);
      if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId);
      }
    }

    // Upload new image
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'profile-pictures',
          public_id: `profile_${clientId}_${Date.now()}`,
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
      uploadStream.end(req.file.buffer);
    });

    // Generate optimized URL
    const optimizedUrl = cloudinary.url(uploadResult.public_id, {
      width: 500,
      height: 500,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto',
      fetch_format: 'auto'
    });

    // Update client
    client.profilePictureUrl = optimizedUrl;
    await client.save();

    res.status(200).json({
      success: true,
      imageUrl: optimizedUrl,
      publicId: uploadResult.public_id
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ 
      error: 'Image upload failed',
      details: error.message 
    });
  }
};

module.exports = { upload, uploadProfilePicture };