const database = require("../config/db");
const { verifyToken, getUserData } = require("./UserController");
const moment = require('moment-timezone');

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
      "SELECT * FROM `packagesbuydata` WHERE `userId` = ? ORDER BY `id` DESC, `created_at` DESC",
      [userId], // Pass the userId as a parameter to the query
      (err, results) => {
        if (err) {
          return res.status(500).json({ message: "Database query error", error: err });
        }

        if (results.length > 0) {
            // Format timestamps
            const formattedResults = results.map((item) => {
              return {
                ...item,
                packageStartDate: moment(item.packageStartDate).tz("Asia/Colombo").format("YYYY-MM-DD HH:mm:ss"),
                packageStartEnd: moment(item.packageStartEnd).tz("Asia/Colombo").format("YYYY-MM-DD HH:mm:ss"),
                paymentDate: moment(item.payment_date).tz("Asia/Colombo").format("YYYY-MM-DD HH:mm:ss"),
                createdAt: moment(item.created_at).tz("Asia/Colombo").format("YYYY-MM-DD HH:mm:ss"),
                updatedAt: moment(item.updated_at).tz("Asia/Colombo").format("YYYY-MM-DD HH:mm:ss"),
              };
            });
    
            res.json(formattedResults);
        } else {
          res.status(404).json({ message: "No package buy data found" });
        }

        
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateBankDepositImage = async (userId, updateData, bodydata) => {

  try {
    // Get the current timestamp for created_at and updated_at in Sri Lanka time
    const currentTimestamp = moment
      .tz("Asia/Colombo")
      .format("YYYY-MM-DD HH:mm:ss");

    // Calculate packageStartDate and packageStartEnd
    const packageStartDate = currentTimestamp;
    const packageStartEnd = moment
      .tz("Asia/Colombo")
      .add(bodydata.duration, "month")
      .format("YYYY-MM-DD HH:mm:ss");

    // Determine if a discount is applied
    const withDiscount = bodydata.discount == 'false' ? 0 : 1;
    const withrefaralCode = bodydata.withrefaralCode == '' ? null : bodydata.withrefaralCode;

    // Prepare the insert query
    const insertQuery = `
      INSERT INTO packagesbuydata 
        (userId, price, duration, packageStartDate, packageStartEnd, plan_name, payment_date, payment_status, payment_method, approved, receiptImage, withDiscount, withrefaralCode, created_at, updated_at) 
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Set the values from the request body and other data
    const values = [
      userId,
      bodydata.total_price,
      bodydata.duration,
      packageStartDate,
      packageStartEnd,
      bodydata.plan_name,
      packageStartDate, // payment_date same as packageStartDate
      0, // payment_status
      'Deposit', // payment_method set to NULL
      0, // approved set to 1
      updateData.bankDepositImage || null, // receiptImage from the uploaded file
      withDiscount,
      withrefaralCode,
      currentTimestamp,
      currentTimestamp,
    ];

    // Execute the insert query
    db.query(insertQuery, values, async (error, results, fields) => {
      if (error) {
        console.error("Error inserting package buy data:", error);
        throw new Error("Internal server error");
      }
      if (results.affectedRows > 0) {
        console.log("Package buy data inserted successfully");
        return { success: true, message: "Package buy data inserted successfully" };
      } else {
        return { success: false, message: "Failed to insert package buy data" };
      }
    });
  } catch (error) {
    console.error("Error updating package buy data:", error);
    throw new Error("Internal server error");
  }
};

module.exports = {
  getPackages,
  getPackagesPaymentData,
  updateBankDepositImage
};
