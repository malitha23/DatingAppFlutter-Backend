const router = require("express").Router();

const authController = require("../controllers/UserController.js");

router.post("/register", authController.register);
router.get("/getUser", authController.getUser);
router.post("/login", authController.login);
router.get("/friends/:userId", authController.getFriendsList);
router.post("/register_steps_user_data", authController.register_steps_user_data);
router.post("/user_terms_agree", authController.user_terms_agree);
router.post("/register_submitPortfolio", authController.register_user_portfolio_data);
router.post("/register_updatePortfolio", authController.update_register_user_portfolio_data);
router.get("/getAllUsersToHomepage", authController.getAllUsersToHomepage);
router.get("/getUserFriendsPendinglistData", authController.getUserFriendsPendinglistData);
router.get("/getUserFriendslistData", authController.getUserFriendslistData);
router.get("/hartings/:userId", authController.getHartingList);

module.exports = router;
