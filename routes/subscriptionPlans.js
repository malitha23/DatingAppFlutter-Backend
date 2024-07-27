const router = require("express").Router();

const authController = require("../controllers/subscriptionPlansController.js");

router.get('/getsubscriptionPlanss', authController.getsubscriptionPlans);


module.exports = router;
// hi