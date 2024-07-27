const router = require("express").Router();

const authController = require("../controllers/UserController.js");

router.post("/register", authController.register);
router.get("/getUser", authController.getUser);
router.post("/loginn", authController.login);
router.get("/friends/:userId", authController.getFriendsList);
router.get("/getMessagessList/:userId", authController.getMessagessList);
router.post("/register_steps_user_data", authController.register_steps_user_data);
router.post("/user_terms_agree", authController.user_terms_agree);
router.post("/update_user_nic_images", authController.update_user_nic_images);
router.post("/register_submitPortfolio", authController.register_user_portfolio_data);
router.post("/register_updatePortfolio", authController.update_register_user_portfolio_data);
router.get("/getAllUsersToHomepage", authController.getAllUsersToHomepage);
router.get("/getUserFriendsPendinglistData", authController.getUserFriendsPendinglistData);
router.get("/getUserFriendslistData", authController.getUserFriendslistData);
router.get("/hartings/:userId", authController.getHartingList);
router.put('/update-profile-pic/:userId', authController.updateProfilePic);

module.exports = router;
