// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({ message: "No authorization header provided." });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: "Token not found or incorrectly formatted." });
    }
    
    try {
        const decoded = jwt.verify(token, 'lovebrids2024');
        req.user = decoded; // Assuming the token contains user info
        next();
    } catch (error) {
        res.status(401).json({ message: "Authentication failed." });
    }
};

module.exports = authMiddleware;
