const router = require("express").Router();
const authController = require("../controllers/packageController.js");
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { verifyToken, getUserData } = require("../controllers/UserController");

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
      try {
        const token = req.headers.authorization;
        const decoded = verifyToken(token);
        if (!decoded) {
          return cb(new Error("Unauthorized"));
        }
  
        const userData = await getUserData(decoded.nic);
        if (!userData) {
          return cb(new Error("User not found"));
        }
  
        const userId = userData["id"];
        const userDir = path.join(__dirname, '../uploadsImages', userId.toString(), 'bankDepositImage');
  
        // Ensure directory exists
        await fs.ensureDir(userDir);
        cb(null, userDir);
      } catch (err) {
        cb(err);
      }
    },
    filename: function (req, file, cb) {
      cb(null, `${file.originalname}`);
    }
  });
  
const upload = multer({ storage: storage });

  // Route to handle bank deposit image upload
router.post('/update_user_bankdeposite_images', upload.single('bankDepositImage'), async (req, res) => {
    try {
      const token = req.headers.authorization;
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ message: "Unauthorized" });
      }
  
      const userData = await getUserData(decoded.nic);
      if (!userData) {
        return res.status(404).json({ message: "User not found" });
      }
  
      const userId = userData["id"];
      const bankDepositImagePath = req.file ? `/user/view/${userId}/bankDepositImage/${req.file.filename}` : null;
  
      // Optional: Delete old bank deposit image if needed
      if (bankDepositImagePath && userData.bankDepositImage && userData.bankDepositImage !== bankDepositImagePath) {
        const oldBankDepositImagePath = path.join(__dirname, '../uploadsImages', userId.toString(), 'bankDepositImage', path.basename(userData.bankDepositImage));
        if (fs.existsSync(oldBankDepositImagePath)) {
          fs.unlink(oldBankDepositImagePath, err => {
            if (err) console.error('Error deleting old bank deposit image:', err);
          });
        }
      }
  
      // Save new bank deposit image path to the database
      await authController.updateBankDepositImage(userId, {
        bankDepositImage: bankDepositImagePath,
      }, req.body);
  
      res.status(200).json({ message: "Bank deposit image updated successfully" });
    } catch (error) {
      console.error('Error during file upload:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  
router.get('/getpackages', authController.getPackages);
router.get('/getpackagespaymentdata', authController.getPackagesPaymentData);

module.exports = router;
