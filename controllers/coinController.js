const moment = require('moment-timezone');
const database = require("../config/db");
const fetch = require("node-fetch"); 
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
  if (!userData) {
    return res.status(404).json({ message: "User not found" });
  }

  const userId = userData["id"];

  // Extract the coin balance from the request body
  // const { coin_balance } = req.body;
  const coin_balance = await getcoin_balance(userData["referral_code"]?? '');
  // Get the current timestamp for created_at and updated_at
  const currentTimestamp = new Date();

  // Check if userId exists in the coin_balance table
  const checkUserSql = 'SELECT COUNT(*) AS count FROM coin_balance WHERE userId = ?';
  db.query(checkUserSql, [userId], (checkErr, checkResult) => {
    if (checkErr) {
      console.error("Error checking user existence: ", checkErr);
      return res.status(500).json({ message: "Error checking user existence" });
    }
  
    const userExists = checkResult[0].count > 0;
    if (userExists) {
      // Update the existing record
      const updateSql = `
        UPDATE coin_balance
        SET coin_balance = ?, updated_at = ?
        WHERE userId = ?
      `;
      const updateValues = [coin_balance, currentTimestamp, userId];
  
      db.query(updateSql, updateValues, async (updateErr, updateResult) => {
        if (updateErr) {
          console.error("Error updating coin balance: ", updateErr);
          return res.status(500).json({ message: "Error updating coin balance" });
        }
  
        await insertFreePackageOneMonth(req);
        res.status(200).json({ message: "Coin balance updated successfully", coin_balance, userData });
      });
    } else{
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

db.query(insertSql, insertValues, async (err, result) => {
  if (err) {
    console.error("Error inserting coin balance: ", err);
    return res.status(500).json({ message: "Error inserting coin balance" });
  }
  await insertFreePackageOneMonth(req);
  res.status(200).json({ message: "Coin balance inserted successfully",coin_balance, userData });

});
    }
  });
};

const getcoin_balance = (referral_code) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM referral_code_offers WHERE referral_code = ?`;
    // Query the database to retrieve user data based on the NIC number
    db.query(sql, [referral_code], (err, results) => {
      if (err) {
        console.error(err);
        reject(err); // Reject with the error object
      } else {
        // If user data is found, resolve the promise with the user data
        if (results.length > 0) {
          resolve(results[0].add_hearts);
        } else {
          const sql = `SELECT * FROM registered_user_free_hearts_count`;
          // Query the database to retrieve user data based on the NIC number
          db.query(sql, [referral_code], (err, results2) => {
            if (err) {
              console.error(err);
              reject(err); // Reject with the error object
            } else {
              // If user data is found, resolve the promise with the user data
              if (results2.length > 0) {
                resolve(results2[0].hearts_count);
              } else {
                resolve(0);
              }
            }
          });
        }
      }
    });
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
  if (!userData) {
    return res.status(404).json({ message: "User not found" });
  }
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

const insertFreePackageOneMonth = async (req, res) => {
  // Extract token from the request headers
  const token = req.headers.authorization;

  // Verify the token
  const decoded = verifyToken(token);
  if (!decoded) {
    //   return res.status(401).json({ message: "Unauthorized" });
  }

  const generatedKey = await generateKey(decoded.nic);

  const userData = await getUserData(decoded.nic);
  if (!userData) {
    //  return res.status(404).json({ message: "User not found" });
  }
  const userId = userData["id"];
  const  whatsAppNumber  = userData["whatsAppNumber"];
  const formattedPhoneNumber = formatPhoneNumber(whatsAppNumber);

  // Check if `whatsAppNumber` exists and is of valid length
  if (!whatsAppNumber || whatsAppNumber.length !== 10) {
    return res
      .status(404)
      .json({ message: "User phone number not found or invalid" });
  }

  // Get the current timestamp for created_at and updated_at in Sri Lanka time
  const currentTimestamp = moment
    .tz("Asia/Colombo")
    .format("YYYY-MM-DD HH:mm:ss");



  const insertQuery = `
    INSERT INTO packagesbuydata 
      (userId, price, duration, packageStartDate, packageStartEnd, plan_name, payment_date, payment_status, payment_method, approved, receiptImage created_at, updated_at) 
    VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const price = 0;
  const duration = 1;
  const plan_name = "basic";
  const payment_status = 1;

  // Calculate packageStartDate and packageStartEnd
  const packageStartDate = currentTimestamp;
  const packageStartEnd = moment
    .tz("Asia/Colombo")
    .add(1, "month")
    .format("YYYY-MM-DD HH:mm:ss");

  const values = [
    userId,
    price,
    duration,
    packageStartDate,
    packageStartEnd,
    plan_name,
    packageStartDate, // payment_date same as packageStartDate
    payment_status,
    null, // payment_method set to NULL
    1, // approved set to 1
    null, // receiptImage set to NULL
    currentTimestamp,
    currentTimestamp,
  ];

  db.query(insertQuery, values, async (error, results, fields) => {
    if (error) {
      //   console.error("Error inserting data:", error);
      //   return res.status(500).json({ message: "Failed to insert data" });
    }
    
    try {
      // Update user key
      await updateKey(userId, generatedKey, formattedPhoneNumber);

    //  console.log("Insert successful:", results);
    //  return res.status(200).json({ message: "Insert successful", data: results });
    } catch (error) {
  //    console.error("Error updating key:", error);
    //  return res.status(500).json({ message: "Failed to update user key" });
    }
  });
};
 
const formatPhoneNumber = (phoneNumber) => {
  // Remove any non-digit characters
  let cleaned = ('' + phoneNumber).replace(/\D/g, '');

  // Check if the number starts with '0' and remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Ensure the phone number is 10 digits long after removing the leading zero
  if (cleaned.length !== 9) {
    throw new Error('Invalid phone number length');
  }

  // Add international dialing code prefix (e.g., 94 for Sri Lanka)
  const formattedNumber = `94${cleaned}`;

  return formattedNumber;
};

const updateKey = async (userId, newKey, formattedPhoneNumber) => {

  const updateQuery = `
    UPDATE users
    SET generatedKey = ?
    WHERE id = ?
  `;

  const updateValues = [
    newKey,
    userId
  ];

  db.query(updateQuery, updateValues, async (err, result) => {
    if (err) {
      console.error('Error updating key:', err);
      throw err;
    }
      // Send OTP via Notify.lk
      const message = `Welcome to LOVEBIRDS. Your registration code is ${newKey}`;
      const notifyURL = `https://app.notify.lk/api/v1/send?user_id=${
        process.env.NOTIFY_LK_USER_ID
      }&api_key=${process.env.NOTIFY_LK_API_KEY}&sender_id=${
        process.env.NOTIFY_LK_SENDER_ID
      }&to=${formattedPhoneNumber}&message=${encodeURIComponent(
        message
      )}`;

      try {
        const response = await fetch(notifyURL);

        // Check if the response status is OK
        if (!response.ok) {
            const errorText = await response.text();
            console.log(errorText);
        }

        // Optionally parse JSON response if needed
        const responseData = await response.json();
        console.log('Notify.lk Response:', responseData);
      } catch (fetchError) {
        console.log(fetchError);
     
      }
  });
};

// Function to generate the key
const generateKey = async (nic) => {
  try {
    // Get current timestamp in Asia/Colombo timezone
    const timestamp = moment.tz('Asia/Colombo');

    // Generate key in format LBHHmmss
    const generatedKey = `LB${timestamp.format('HHmmss')}`;

    // Append the last character of userId to the generated key
    const lastChar = nic.slice(-4);
    const keyWithUserId = `${generatedKey}${lastChar}`;

    // Check if the generated key already exists in the database
    const keyExists = await checkKeyExists(keyWithUserId);

    if (keyExists) {
      // If key exists, generate a new key recursively
      return generateKey(nic);
    }

    return keyWithUserId;
  } catch (error) {
    console.error('Error generating key:', error);
    throw error; // Handle or rethrow the error as needed
  }
};

// Function to check if the key exists in the database
const checkKeyExists = async (key) => {
  return new Promise((resolve, reject) => {
    db.query('SELECT COUNT(*) AS count FROM users WHERE `generatedKey` = ?', [key], (err, results) => {
      if (err) {
        console.error('Error checking key:', err);
        return reject(err);
      }
      const count = results[0].count;
      resolve(count > 0);
    });
  });
};

const updateheartsBankDepositImage = async (userId, updateData, bodydata) => {
  console.log(userId);
  console.log(updateData);
  console.log(bodydata);

  // Extract data from the parameters
  const hearts = bodydata.hearts || 0;
  const total_price = bodydata.total_price || '0.00';
  const withrefaral_code = bodydata.withrefaralCode || '';
  const bank_receipt_image = updateData.heartsBankDepositImage || '';

  // Get current timestamp
  const currentTimestamp = moment.tz("Asia/Colombo").format("YYYY-MM-DD HH:mm:ss");

  // SQL Insert Query
  const insertQuery = `
    INSERT INTO heartsbuydata (
      userId, hearts, total_price, withrefaral_code, bank_receipt_image, approved, payment_method, payment_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Data to insert
  const values = [
    userId,
    hearts,
    total_price,
    withrefaral_code,
    bank_receipt_image,
    0, // approved (default to 0)
    'Deposit', // payment_method set to 'Deposit'
    currentTimestamp, // payment_date
    currentTimestamp, // created_at
    currentTimestamp  // updated_at
  ];

  try {
    // Execute the query
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

  } catch (err) {
    console.error('Error executing query: ' + err.stack);
    return { success: false, message: "Failed to insert package buy data" };
  }

};

const getheartsBankDeposit = async (req, res) => {
  // Extract token from the request headers
  const token = req.headers.authorization;

  // Verify the token
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userData = await getUserData(decoded.nic);
  if (!userData) {
    return res.status(404).json({ message: "User not found" });
  }
  const userId = userData["id"];

  // Query to get hearts buy data
  db.query(
    "SELECT * FROM heartsbuydata WHERE userId = ? ORDER BY id DESC",
    [userId],
    (err, results) => {
      if (err) {
        console.error("Error fetching hearts buy data: ", err);
        return res.status(500).json({ message: "Error fetching hearts buy data" });
      }
      if (results.length > 0) {
        res.status(200).json(results);
      } else {
        res.status(404).json({ message: "No hearts buy data found" });
      }
    }
  );
};

module.exports = {
  insertCoinBalance,
  getCoinBalance,
  insertFreePackageOneMonth,
  getheartsBankDeposit,
  updateheartsBankDepositImage
};
