const router = require("express").Router();
const adminController = require("../controllers/adminController.js");
const adminControllerToOffers = require("../controllers/adminController_To_Offres.js");
const adminMiddleware = require("../middlewares/adminMiddleware.js");
const UserController = require("../controllers/UserController.js");

// Apply the admin middleware to routes that only admins should access
router.use(adminMiddleware);

// Admin routes
router.get("/pending-packages-payments", async (req, res, next) => {
    try {
        await adminController.getPendingPackagespayments (req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

router.post("/getSubcriptionPackagesForPendingPackagesPayments", async (req, res, next) => {
    try {
        await adminController.getSubcriptionPackagesForPendingPackagesPayments (req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

router.post("/approveOrrejectPendingPackagesPayments", async (req, res, next) => {
    try {
        await adminController.approveOrRejectPendingPackagesPayments (req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

// Admin routes
router.get("/getAllNewUsers", async (req, res, next) => {
    try {
        await adminController.getAllNewUsers (req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

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

router.put("/UpdateUserStatusForAdmin/:userId", async (req, res, next) => {
    try {
        await adminController.updateUserStatus(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

router.post("/UpdateUserBulkStatusForAdmin", async (req, res, next) => {
    try {
        await adminController.updateUserBulkStatuses(req, res);
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

router.get("/getsubscriptionPlansForAdmin", async (req, res, next) => {
    try {
        await adminController.getsubscriptionPlansForAdmin(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
}); 


router.post("/subscription-plans-ForAdmin", async (req, res, next) => {
    try {
        await adminController.addSubscriptionPlan(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

router.put("/subscription-plans-ForAdmin/:id", async (req, res, next) => {
    try {
        await adminController.updateSubscriptionPlan(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
});

router.delete('/subscription-plans-deleteForAdmin/:id', async (req, res) => {
    try {
      await adminController.deleteSubscriptionPlan(req, res);
    } catch (error) {
      // Catch errors that are thrown by deleteSubscriptionPlan
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error deleting subscription plan', error });
      }
    }
  });
  

  router.put("/updateSelectedUserCoinBalance/:userId", async (req, res, next) => {
    try {
        await adminController.updateSelectedUserCoinBalance(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
}); 

/** Admin Offers Setup routes -------------------------------------------------------------------------------------   **/

router.get("/getreferralOffersForAdmin", async (req, res, next) => {
    try {
        await adminControllerToOffers.getAllReferralOffersForAdmin(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
}); 
router.post("/AddNewReferralOffersForAdmin", async (req, res, next) => {
    try {
        await adminControllerToOffers.AddNewReferralOffersForAdmin(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
}); 
router.delete('/deleteReferralOfferForAdmin/:id', async (req, res) => {
    try {
      await adminControllerToOffers.deleteReferralOffer(req, res);
    } catch (error) {
      // Catch errors that are thrown by deleteSubscriptionPlan
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error deleting subscription plan', error });
      }
    }
  });
router.put("/updateReferralOfferForAdmin/:id", async (req, res, next) => {
    try {
        await adminControllerToOffers.updateReferralOffer(req, res);
    } catch (err) {
        next(err); // Pass the error to the error-handling middleware
    }
}); 

module.exports = router;
