const router = require("express").Router();

const authController = require("../controllers/subscriptionPlansController.js");

router.get('/getsubscriptionPlans', authController.getsubscriptionPlans);


module.exports = router;
// hi