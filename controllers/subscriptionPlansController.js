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

    // Process the results to convert integer values and parse JSON
    const processedResults = results.map(plan => ({
      ...plan,
      discount: plan.discount === 1, // Convert integer to boolean
      features: JSON.parse(plan.features) // Parse JSON string to object
    }));

    res.status(200).json(processedResults);
  });
};




module.exports = {
  getsubscriptionPlans,
};
