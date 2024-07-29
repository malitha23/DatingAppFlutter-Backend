const router = require("express").Router();

const authController = require("../controllers/subscriptionPlansController.js");

router.get('/getsubscriptionPlans', authController.getsubscriptionPlans);
router.post('/checkReferralCodeToGetOffers', authController.checkReferralCodeToGetOffers);


module.exports = router;
