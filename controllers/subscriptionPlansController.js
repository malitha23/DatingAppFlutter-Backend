const database = require("../config/db");
const { verifyToken, getUserData } = require("./UserController");

const db = database.connection;


const getsubscriptionPlans = async (req, res) => {
  
  const sql = 'SELECT * FROM subscription_plans';

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching subscription plans:', err);
      return res.status(500).json({ message: 'Error fetching subscription plans' });
    }

    res.status(200).json(results);
  });
};




module.exports = {
  getsubscriptionPlans,
};
