const router = require("express").Router();
const adminController = require("../controllers/adminController.js");
const adminMiddleware = require("../middlewares/adminMiddleware.js");
const UserController = require("../controllers/UserController.js");

// Apply the admin middleware to routes that only admins should access
router.use(adminMiddleware);

// Admin routes
router.get("/getAllUsers", async (req, res, next) => {
    try {
        await UserController.getAllUsersToHomepage(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

router.post("/addNewUserForAdmin", async (req, res, next) => {
    try {
        await adminController.addNewUserForAdmin(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

router.delete('/deleteuser/:id', async (req, res) => {
    const userId = req.params.id;
  
    try {
      await adminController.deleteUserData(userId);
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting user', error });
    }
  });

router.put("/UpdateUserForAdmin/:userId", async (req, res, next) => {
    try {
        await adminController.updateUser(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
}); 

router.put("/UpdateUserPackageForAdmin/:userId", async (req, res, next) => {
    try {
        await adminController.updateuserPackageData(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
}); 


router.get("/getHeartsPackages", async (req, res, next) => {
    try {
        await adminController.getHeartsPackages(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
}); 


router.post("/addHeartsPackage", async (req, res, next) => {
    try {
        await adminController.addHeartsPackage(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

router.put("/updateHeartsPackage/:packageId", async (req, res, next) => {
    try {
        await adminController.updateHeartsPackage(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

router.delete('/deleteHeartsPackage/:packageId', async (req, res) => {
  
    try {
      await adminController.deleteHeartsPackage(req, res);
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting user', error });
    }
  });

  router.put("/updateSelectedUserCoinBalance/:userId", async (req, res, next) => {
    try {
        await adminController.updateSelectedUserCoinBalance(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
}); 
module.exports = router;
