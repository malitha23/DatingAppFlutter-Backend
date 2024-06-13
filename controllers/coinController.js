const database = require("../config/db");
const { verifyToken, getUserData } = require("./UserController");

const db = database.connection;

const insertCoinBalance = async (req, res) => {
  // Extract token from the request headers
  const token = req.headers.authorization;

  // Verify the token
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userData = await getUserData(decoded.nic);
  const userId = userData["id"];

  // Extract the coin balance from the request body
  const { coin_balance } = req.body;

  // Get the current timestamp for created_at and updated_at
  const currentTimestamp = new Date();

  // Insert a new record into the coin_balance table
  const insertSql = `
    INSERT INTO coin_balance (userId, coin_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `;

  const insertValues = [
    userId,
    coin_balance,
    currentTimestamp,
    currentTimestamp,
  ];

  db.query(insertSql, insertValues, (err, result) => {
    if (err) {
      console.error("Error inserting coin balance: ", err);
      return res.status(500).json({ message: "Error inserting coin balance" });
    }
    res.status(200).json({ message: "Coin balance inserted successfully" });
  });
};

const getCoinBalance = async (req, res) => {
  // Extract token from the request headers
  const token = req.headers.authorization;

  // Verify the token
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userData = await getUserData(decoded.nic);
  const userId = userData["id"];

  // Query to get coin balance
  db.query(
    "SELECT coin_balance FROM coin_balance WHERE userId = ?",
    [userId],
    (err, results) => {
      if (err) {
        console.error("Error fetching coin balance: ", err);
        return res.status(500).json({ message: "Error fetching coin balance" });
      }
      if (results.length > 0) {
        res.status(200).json({ balance: results[0].coin_balance });
      } else {
        res.status(404).json({ message: "No coin balance found" });
      }
    }
  );
};

module.exports = {
  insertCoinBalance,
  getCoinBalance,
};
