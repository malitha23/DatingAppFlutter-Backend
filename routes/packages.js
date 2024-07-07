const router = require("express").Router();

const authController = require("../controllers/packageController.js");

router.get('/getpackages', authController.getPackages);
router.get('/getpackagespaymentdata', authController.getPackagesPaymentData);

module.exports = router;
