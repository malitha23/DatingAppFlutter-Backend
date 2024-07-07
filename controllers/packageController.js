const database = require("../config/db");
const { verifyToken, getUserData } = require("./UserController");

const db = database.connection;


const getPackages = async (req, res) => {
  // Extract token from the request headers
  const token = req.headers.authorization;

  // Verify the token
  // const decoded = verifyToken(token);
  // if (!decoded) {
  //   return res.status(401).json({ message: "Unauthorized" });
  // }

  // Query to get coin balance
  db.query(
    "SELECT * FROM packages",
    (err, results) => {
      if (err) throw err;
      res.json(results);
    }
  );
};

const getPackagesPaymentData = async (req, res) => {
  try {
    // Extract token from the request headers
    const token = req.headers.authorization;

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Retrieve user data using the decoded token information
    const userData = await getUserData(decoded.nic);
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }
    const userId = userData["id"];

    // Query to get package data based on the user ID
    db.query(
      "SELECT * FROM `packagesbuydata` WHERE `userId` = ?",
      [userId], // Pass the userId as a parameter to the query
      (err, results) => {
        if (err) {
          return res.status(500).json({ message: "Database query error", error: err });
        }
        res.json(results);
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


module.exports = {
  getPackages,
  getPackagesPaymentData
};
