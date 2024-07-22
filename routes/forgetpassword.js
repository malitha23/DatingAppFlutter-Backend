const router = require("express").Router();

const authController = require("../controllers/forgetpasswordController.js");

router.post('/forgetpassword', authController.forgetpassword);
router.post('/verifyOtp', authController.verifyOtp);
router.post('/changepassword', authController.changepassword);

module.exports = router;
