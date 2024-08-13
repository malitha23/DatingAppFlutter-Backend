const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const authController = require('../controllers/UserController.js');
const { verifyToken, getUserData } = require("../controllers/UserController");

const router = express.Router();

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
      const userDir = path.join(__dirname, '../uploadsImages', userId.toString());

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

// Route to handle file uploads and user data registration
router.post("/register_steps_user_data", upload.fields([
  { name: 'profilePic', maxCount: 1 },
  { name: 'otherImages', maxCount: 10 }
]), async (req, res) => {
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
    const profilePicPath = req.files.profilePic ? `/user/view/${userId}/${req.files.profilePic[0].filename}` : null;
    const otherImagesPaths = req.files.otherImages ? req.files.otherImages.map(file => `/user/view/${userId}/${file.filename}`) : [];

    // Optional: Delete old profile picture and other images if needed
    if (profilePicPath && userData.profilePic && userData.profilePic !== profilePicPath) {
      const oldProfilePicPath = path.join(__dirname, '../uploadsImages', userId.toString(), path.basename(userData.profilePic));
      if (fs.existsSync(oldProfilePicPath)) {
        fs.unlink(oldProfilePicPath, err => {
          if (err) console.error('Error deleting old profile picture:', err);
        });
      }
    }

    // Ensure oldOtherImages is an array
    const oldOtherImages = Array.isArray(userData.otherImages) ? userData.otherImages : [];
    oldOtherImages.forEach(image => {
      if (!otherImagesPaths.includes(image)) {
        const oldImagePath = path.join(__dirname, '../uploadsImages', userId.toString(), path.basename(image));
        if (fs.existsSync(oldImagePath)) {
          fs.unlink(oldImagePath, err => {
            if (err) console.error('Error deleting old other images:', err);
          });
        }
      }
    });

    // Save new data to the database
    await authController.register_steps_user_data(userId, {
      profilePic: profilePicPath,
      otherImages: otherImagesPaths,
      gender: req.body.gender,
      age: req.body.age,
      birthday: req.body.birthday,
      interests: req.body.interests,
      terms_agree: req.body.terms_agree
    });

    res.status(200).json({ message: "Data saved successfully" });
  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post('/update_user_nic_images', upload.fields([{ name: 'frontImage' }, { name: 'backImage' }]), async (req, res) => {
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

    const userId = userData.id;
    const frontImagePath = req.files['frontImage'] ? req.files['frontImage'][0].path : null;
    const backImagePath = req.files['backImage'] ? req.files['backImage'][0].path : null;

    // Define relative paths with forward slashes
    const relativeFrontImagePath = frontImagePath ? path.posix.join('/user/view', userId.toString(), path.basename(frontImagePath)) : null;
    const relativeBackImagePath = backImagePath ? path.posix.join('/user/view', userId.toString(), path.basename(backImagePath)) : null;

    // Optional: Delete old NIC front image if needed
    if (frontImagePath && userData.nicFrontImage && userData.nicFrontImage !== relativeFrontImagePath) {
      const oldFrontImagePath = path.join(__dirname, '../uploadsImages', userId.toString(), path.basename(userData.nicFrontImage));
      if (fs.existsSync(oldFrontImagePath)) {
        fs.unlink(oldFrontImagePath, err => {
          if (err) console.error('Error deleting old NIC front image:', err);
        });
      }
    }

   // Optional: Delete old NIC back image if needed
if (backImagePath) {
  // New back image is uploaded
  if (userData.nicBackImage && userData.nicBackImage !== relativeBackImagePath) {
    const oldBackImagePath = path.join(__dirname, '../uploadsImages', userId.toString(), path.basename(userData.nicBackImage));
    if (fs.existsSync(oldBackImagePath)) {
      fs.unlink(oldBackImagePath, err => {
        if (err) console.error('Error deleting old NIC back image:', err);
      });
    }
  }
} else {console.log(userData);
  // No new back image is uploaded
  if (userData.nicBackImage) {
    console.log(backImagePath);
    const oldBackImagePath = path.join(__dirname, '../uploadsImages', userId.toString(), path.basename(userData.nicBackImage));
    if (fs.existsSync(oldBackImagePath)) {
      fs.unlink(oldBackImagePath, err => {
        if (err) console.error('Error deleting old NIC back image:', err);
      });
    }
  }
}


    // Save new data to the database
    await authController.update_user_nic_images(userId, {
      frontImage: relativeFrontImagePath,
      backImage: relativeBackImagePath,
    });

    res.status(200).json({ message: "Data saved successfully" });
  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// New route to handle profile image upload
router.post('/update_user_profile_images', upload.single('profilePic'), async (req, res) => {
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
    const profilePicPath = req.file ? `/user/view/${userId}/${req.file.filename}` : null;

    // Optional: Delete old profile picture if needed
    if (profilePicPath && userData.profilePic && userData.profilePic !== profilePicPath) {
      const oldProfilePicPath = path.join(__dirname, '../uploadsImages', userId.toString(), path.basename(userData.profilePic));
      if (fs.existsSync(oldProfilePicPath)) {
        fs.unlink(oldProfilePicPath, err => {
          if (err) console.error('Error deleting old profile picture:', err);
        });
      }
    }

    // Save new profile picture path to the database
    await authController.updateProfilePic(userId, {
      profilePic: profilePicPath,
    });

    res.status(200).json({ message: "Profile image updated successfully" });
  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});


router.post("/register", authController.register);
router.get("/getUser", authController.getUser);
router.post("/login", authController.login);
router.get("/friends/:userId", authController.getFriendsList);
router.get("/getMessagessList/:userId", authController.getMessagessList);
router.post("/user_terms_agree", authController.user_terms_agree);
router.post("/update_user_nic_images", authController.update_user_nic_images);
router.post("/register_submitPortfolio", authController.register_user_portfolio_data);
router.post("/register_updatePortfolio", authController.update_register_user_portfolio_data);
router.get("/getAllUsersToHomepage", authController.getAllUsersToHomepage);
router.get("/getUserFriendsPendinglistData", authController.getUserFriendsPendinglistData);
router.get("/getUserFriendslistData", authController.getUserFriendslistData);
router.get("/hartings/:userId", authController.getHartingList);
// Define your route
router.get('/userDataForProfileView/:friendId', async (req, res) => {
  const token = req.headers.authorization;
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userData = await getUserData(decoded.nic);
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }
    const userId = userData.id;
  const friendId = req.params.friendId;

  try {
      const userData = await authController.getUserDataForProfileView(userId, friendId);

      res.json(userData);
  } catch (err) {
      res.status(404).json({ error: err.toString() });
  }
});
router.delete('/deleteuser', async (req, res) => {
    try {
      await authController.deleteUserData(req);
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting user', error });
    }
  });
  router.post("/logout", authController.logout);


// Route to serve uploaded files
router.get('/view/:userId/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploadsImages', req.params.userId, req.params.filename);
  res.sendFile(filePath, err => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(404).send('File not found');
    }
  });
});

// Route to serve uploaded files
router.get('/view/:userId/heartsBankDepositImage/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploadsImages', req.params.userId,'heartsBankDepositImage',req.params.filename);
  res.sendFile(filePath, err => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(404).send('File not found');
    }
  });
});

// Route to serve uploaded files
router.get('/view/:userId/bankDepositImage/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploadsImages', req.params.userId,'bankDepositImage',req.params.filename);
  res.sendFile(filePath, err => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(404).send('File not found');
    }
  });
});
module.exports = router;
