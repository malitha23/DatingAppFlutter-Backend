const getUserData = require('../controllers/UserController.js');

// middleware/adminMiddleware.js
const adminMiddleware = async (req, res, next) => {
    // Assuming you store user roles in the request object
    // You might get user info from a JWT token, session, etc.
    const user = req.user;
    const userData = await getUserData.getUserData(user.nic);

    if (userData && userData.role === 'admin') {
        next(); // User is an admin, proceed to the next middleware/controller
    } else {
        res.status(403).json({ message: "Access denied. Admins only." });
    }
};


module.exports = adminMiddleware;
