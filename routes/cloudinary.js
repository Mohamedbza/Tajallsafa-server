const { v2: cloudinary } = require('cloudinary');
const dotenv = require('dotenv');
const multer = require('multer');
const { Freelancer } = require('../models/client');

// Load environment variables
dotenv.config();

// Initialize Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET_KEY,
});

// Set up multer for handling file uploads (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function to extract public_id from Cloudinary URL
function extractPublicId(imageUrl) {
  const parts = imageUrl.split('/');
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex === -1 || uploadIndex >= parts.length - 1) {
    return null; // Invalid URL
  }
  const publicIdWithExtension = parts[uploadIndex + 1];
  const publicId = publicIdWithExtension.split('.')[0]; // Remove file extension
  return publicId;
}

// API endpoint to upload profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    console.log("Request body:", req.body); // Log the request body
    console.log("Request file:", req.file); // Log the uploaded file

    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const freelancerId = req.body.freelancerId;

    // Find the freelancer
    const freelancer = await Freelancer.findOne({ _id: freelancerId });

    if (!freelancer) {
      return res.status(404).json({ error: 'Freelancer not found' });
    }

    // Check if the freelancer already has a profile picture
    if (freelancer.profilePictureUrl) {
      // Extract the public_id from the old URL
      const oldPublicId = extractPublicId(freelancer.profilePictureUrl);

      if (oldPublicId) {
        // Delete the old image from Cloudinary
        await cloudinary.uploader.destroy(oldPublicId);
        console.log("Deleted old image with public_id:", oldPublicId);
      }
    }

    // Promisify the Cloudinary upload_stream method
    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'profile-pictures', // Optional: specify a folder in Cloudinary
            public_id: `profile-pictures/${Date.now()}`, // Optional: specify a public ID
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        // Pass the file buffer to Cloudinary
        uploadStream.end(buffer);
      });
    };

    // Upload file buffer directly to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer);

    // Generate optimized and auto-cropped URLs
    const optimizeUrl = cloudinary.url(result.public_id, {
      fetch_format: 'auto',
      quality: 'auto',
    });

    const autoCropUrl = cloudinary.url(result.public_id, {
      crop: 'auto',
      gravity: 'auto',
      width: 1200,
      height: 1200,
    });

    // Update the freelancer's profile picture URL
    freelancer.profilePictureUrl = autoCropUrl;
    await freelancer.save();

    // Send response
    res.status(200).json({
      message: 'Image uploaded and profile picture updated successfully',
      imageUrl: result.secure_url,
      optimizeUrl,
      autoCropUrl,
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Error uploading image' });
  }
};

// Export the multer upload middleware and controller function
module.exports = { upload, uploadProfilePicture };