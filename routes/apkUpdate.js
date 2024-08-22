const router = require("express").Router();

const authController = require("../controllers/apkUpdateController");

router.get('/version-check', authController.versionCheck);

module.exports = router;
