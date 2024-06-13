const router = require("express").Router();

const authController = require("../controllers/coinController.js");

router.post('/insert_coin_balance', authController.insertCoinBalance);

module.exports = router;
