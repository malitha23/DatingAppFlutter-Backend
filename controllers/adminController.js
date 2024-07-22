const database = require("../config/db");
const bcrypt = require("bcrypt");
const moment = require("moment-timezone");
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const { verifyToken, getUserData } = require("./UserController");

const db = database.connection;

const getAllUsers = async (req, res) => {
  try {
    res.status(200).json("users");
  } catch (error) {
    res.status(500).json({ message: "Error retrieving users", error });
  }
};

// Function to handle new user registration for an admin
const addNewUserForAdmin = async (req, res) => {
  // Extract user data from the request body
  const {
    nic,
    password,
    firstName,
    lastName,
    whatsAppNumber,
    job,
    location,
    marriageStatus,
    heightFt,
    heightIn,
    weight,
    address,
    personalityDescription,
    alcoholConsumption,
    lookingFor,
    gender,
    age,
    birthday,
    interests,
    profilePic,
    otherImages,
    terms_agree,
    nicfrontImage,
    nicbackImage,
    coin_balance,
  } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if the NIC already exists in the database
    db.query(
      "SELECT * FROM users WHERE nic = ?",
      [nic],
      async (err, results) => {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ message: "Error checking user existence" });
        }

        // If NIC already exists, send response
        if (results.length > 0) {
          return res
            .status(400)
            .json({ message: "User with this NIC already exists" });
        }

        // Insert user into the database
        db.query(
          "INSERT INTO users (nic, password) VALUES (?, ?)",
          [nic, hashedPassword],
          (err, result) => {
            if (err) {
              console.error(err);
              return res
                .status(500)
                .json({ message: "Error registering user" });
            }

            // Retrieve the newly inserted user data
            db.query(
              "SELECT * FROM users WHERE nic = ?",
              [nic],
              (err, userResults) => {
                if (err) {
                  console.error(err);
                  return res
                    .status(500)
                    .json({ message: "Error retrieving user data" });
                }

                const userId = userResults[0].id;

                // Insert user details into register_steps_user_data
                const insertStepsSql = `
            INSERT INTO register_steps_user_data (userId, gender, age, birthday, interests, profilePic, otherImages, terms_agree, nicFrontImage, nicBackImage)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

                const insertStepsValues = [
                  userId,
                  gender,
                  age,
                  birthday,
                  JSON.stringify(interests), // Convert to JSON if necessary
                  profilePic,
                  JSON.stringify(otherImages), // Convert to JSON if necessary
                  terms_agree,
                  nicfrontImage,
                  nicbackImage,
                ];

                db.query(
                  insertStepsSql,
                  insertStepsValues,
                  async (insertErr, insertResult) => {
                    if (insertErr) {
                      await deleteUser(userId);
                      console.error(insertErr);
                      return res
                        .status(500)
                        .json({ message: "Error inserting user details" });
                    }

                    const checkQueryfirst =
                      "SELECT * FROM register_user_portfolio_data WHERE whatsAppNumber = ?";
                    db.query(
                      checkQueryfirst,
                      [whatsAppNumber],
                      async (err, results) => {
                        if (err) {
                          await deleteUser(userId);
                          await deleteUserStepsData(userId);
                          return res
                            .status(500)
                            .json({
                              message: "Database query error",
                              error: err,
                            });
                        }

                        if (results.length > 0) {
                          await deleteUser(userId);
                          await deleteUserStepsData(userId);
                          // WhatsApp number already exists
                          return res
                            .status(409)
                            .json({
                              message: "WhatsApp number already exists",
                            });
                        }
                        // Insert user portfolio data
                        const insertPortfolioSql = `
              INSERT INTO register_user_portfolio_data (
                userId, firstName, lastName, whatsAppNumber, job, location, marriageStatus, heightFt, heightIn, weight, address, personalityDescription, alcoholConsumption, lookingFor
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

                        const insertPortfolioValues = [
                          userId,
                          firstName,
                          lastName,
                          whatsAppNumber,
                          job,
                          location,
                          marriageStatus,
                          heightFt,
                          heightIn,
                          weight,
                          address,
                          personalityDescription,
                          alcoholConsumption,
                          lookingFor,
                        ];

                        db.query(
                          insertPortfolioSql,
                          insertPortfolioValues,
                          async (portfolioErr, portfolioResult) => {
                            if (portfolioErr) {
                              await deleteUser(userId);
                              await deleteUserStepsData(userId);
                              console.error(portfolioErr);
                              return res
                                .status(500)
                                .json({
                                  message:
                                    "Error inserting user portfolio data",
                                });
                            }

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

                            db.query(
                              insertSql,
                              insertValues,
                              async (err, result) => {
                                if (err) {
                                  console.error(
                                    "Error inserting coin balance: ",
                                    err
                                  );
                                  await deleteUser(userId);
                                  await deleteUserStepsData(userId);
                                  await deleteUserPortfolioData(userId);

                                  return res
                                    .status(500)
                                    .json({
                                      message: "Error inserting coin balance",
                                    });
                                }
                                const reqs = {
                                  userId,
                                  nic,
                                  password,
                                  firstName,
                                  lastName,
                                  whatsAppNumber,
                                  job,
                                  location,
                                  marriageStatus,
                                  heightFt,
                                  heightIn,
                                  weight,
                                  address,
                                  personalityDescription,
                                  alcoholConsumption,
                                  lookingFor,
                                  gender,
                                  age,
                                  birthday,
                                  interests,
                                  profilePic,
                                  otherImages,
                                  terms_agree,
                                  nicfrontImage,
                                  nicbackImage,
                                  coin_balance,
                                };
                                await insertFreePackageOneMonth(reqs);
                                // Generate JWT token
                                const token = jwt.sign(
                                  { nic: nic },
                                  "lovebrids2024"
                                );

                                // Send response with user data and token
                                res.status(200).json({
                                  message: "User added successfully",
                                  token: token,
                                  user: userResults[0], // Assuming the user data is in the first result
                                });
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing request" });
  }
};

const insertFreePackageOneMonth = async (reqs, res) => {
  const {
    userId,
    nic,
    password,
    firstName,
    lastName,
    whatsAppNumber,
    job,
    location,
    marriageStatus,
    heightFt,
    heightIn,
    weight,
    address,
    personalityDescription,
    alcoholConsumption,
    lookingFor,
    gender,
    age,
    birthday,
    interests,
    profilePic,
    otherImages,
    terms_agree,
    nicfrontImage,
    nicbackImage,
    coin_balance,
  } = reqs;

  const generatedKey = await generateKey(nic);

  const formattedPhoneNumber = formatPhoneNumber(whatsAppNumber);

  // Check if `whatsAppNumber` exists and is of valid length
  if (!whatsAppNumber || whatsAppNumber.length !== 10) {
    await deleteUser(userId);
    await deleteUserStepsData(userId);
    await deleteUserPortfolioData(userId);
    await deleteUserCoinBalance(userId);
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
      (userId, price, duration, packageStartDate, packageStartEnd, plan_name, payment_date, payment_status, created_at, updated_at) 
    VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    currentTimestamp,
    currentTimestamp,
  ];

  db.query(insertQuery, values, async (error, results, fields) => {
    if (error) {
      await deleteUser(userId);
      await deleteUserStepsData(userId);
      await deleteUserPortfolioData(userId);
      await deleteUserCoinBalance(userId);
      //   console.error("Error inserting data:", error);
      //   return res.status(500).json({ message: "Failed to insert data" });
    }

    try {
      // Update user key
      await updateKey(userId, generatedKey, formattedPhoneNumber);

      //  console.log("Insert successful:", results);
      //  return res.status(200).json({ message: "Insert successful", data: results });
    } catch (error) {
      await deleteUser(userId);
      await deleteUserStepsData(userId);
      await deleteUserPortfolioData(userId);
      await deleteUserCoinBalance(userId);
      await deleteUserPackagesData(userId);
      //    console.error("Error updating key:", error);
      //  return res.status(500).json({ message: "Failed to update user key" });
    }
  });
};

const formatPhoneNumber = (phoneNumber) => {
  // Remove any non-digit characters
  let cleaned = ("" + phoneNumber).replace(/\D/g, "");

  // Check if the number starts with '0' and remove it
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // Ensure the phone number is 10 digits long after removing the leading zero
  if (cleaned.length !== 9) {
    throw new Error("Invalid phone number length");
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

  const updateValues = [newKey, userId];

  db.query(updateQuery, updateValues, async (err, result) => {
    if (err) {
      await deleteUser(userId);
      await deleteUserStepsData(userId);
      await deleteUserPortfolioData(userId);
      await deleteUserCoinBalance(userId);
      await deleteUserPackagesData(userId);
      console.error("Error updating key:", err);
      throw err;
    }
    // Send OTP via Notify.lk
    const message = `Welcome to LOVEBIRDS. Your registration code is ${newKey}`;
    const notifyURL = `https://app.notify.lk/api/v1/send?user_id=${
      process.env.NOTIFY_LK_USER_ID
    }&api_key=${process.env.NOTIFY_LK_API_KEY}&sender_id=${
      process.env.NOTIFY_LK_SENDER_ID
    }&to=${formattedPhoneNumber}&message=${encodeURIComponent(message)}`;

    try {
      const response = await fetch(notifyURL);

      // Check if the response status is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.log(errorText);
      }

      // Optionally parse JSON response if needed
      const responseData = await response.json();
      console.log("Notify.lk Response:", responseData);
    } catch (fetchError) {
      console.log(fetchError);
    }
  });
};

// Function to generate the key
const generateKey = async (nic) => {
  try {
    // Get current timestamp in Asia/Colombo timezone
    const timestamp = moment.tz("Asia/Colombo");

    // Generate key in format LBHHmmss
    const generatedKey = `LB${timestamp.format("HHmmss")}`;

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
    console.error("Error generating key:", error);
    throw error; // Handle or rethrow the error as needed
  }
};

// Function to check if the key exists in the database
const checkKeyExists = async (key) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT COUNT(*) AS count FROM users WHERE `generatedKey` = ?",
      [key],
      (err, results) => {
        if (err) {
          console.error("Error checking key:", err);
          return reject(err);
        }
        const count = results[0].count;
        resolve(count > 0);
      }
    );
  });
};

const deleteUser = async (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM `users` WHERE `id` = ?",
      [userId],
      (error, results) => {
        if (error) return reject(error);
        resolve(results);
      }
    );
  });
};

const deleteUserPortfolioData = async (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM `register_user_portfolio_data` WHERE `userId` = ?",
      [userId],
      (error, results) => {
        if (error) return reject(error);
        resolve(results);
      }
    );
  });
};

const deleteUserStepsData = async (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM `register_steps_user_data` WHERE `userId` = ?",
      [userId],
      (error, results) => {
        if (error) return reject(error);
        resolve(results);
      }
    );
  });
};

const deleteUserPackagesData = async (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM `packagesbuydata` WHERE `userId` = ?",
      [userId],
      (error, results) => {
        if (error) return reject(error);
        resolve(results);
      }
    );
  });
};

const deleteUserCoinBalance = async (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM `coin_balance` WHERE `userId` = ?",
      [userId],
      (error, results) => {
        if (error) return reject(error);
        resolve(results);
      }
    );
  });
};

const deleteFriendships = async (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM `friendships` WHERE `user_id` = ? OR `friend_id` = ?",
      [userId, userId],
      (error, results) => {
        if (error) return reject(error);
        resolve(results);
      }
    );
  });
};

const deleteMessages = async (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM `messages` WHERE `sender_id` = ? OR `receiverId` = ?",
      [userId, userId],
      (error, results) => {
        if (error) return reject(error);
        resolve(results);
      }
    );
  });
};

const deleteUserHarting = async (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "DELETE FROM `user_harting` WHERE `user_id` = ? OR `friend_id` = ?",
      [userId, userId],
      (error, results) => {
        if (error) return reject(error);
        resolve(results);
      }
    );
  });
};

const deleteUserData = async (userId) => {


  try {

    // Delete user from all related tables
    await deleteUser(userId);
    await deleteUserPortfolioData(userId);
    await deleteUserStepsData(userId);
    await deleteUserPackagesData(userId);
    await deleteUserCoinBalance(userId);
    await deleteFriendships(userId);
    await deleteMessages(userId);
    await deleteUserHarting(userId);

    console.log(`User with ID ${userId} deleted successfully from all tables.`);
  } catch (error) {
   
    console.error(`Error deleting user with ID ${userId}:`, error);
    throw error;
  } finally {
  
  }
};


const updateUser = async (req, res) => {
  const userId = req.params.userId;
  const {
    nic,
    userStatus,
    password,
    firstName,
    lastName,
    whatsAppNumber,
    job,
    location,
    marriageStatus,
    heightFt,
    heightIn,
    weight,
    address,
    personalityDescription,
    alcoholConsumption,
    lookingFor,
    gender,
    age,
    birthday,
    interests,
    profilePic,
    otherImages,
    terms_agree,
    nicfrontImage,
    nicbackImage,
    coin_balance,
  } = req.body;

  try {
    // Check if user exists
    db.query("SELECT * FROM users WHERE id = ?", [userId], async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error checking user existence" });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      // If a new password is provided, hash it
      let updateValues = [nic, firstName, lastName, whatsAppNumber, job, location, marriageStatus, heightFt, heightIn, weight, address, personalityDescription, alcoholConsumption, lookingFor, gender, age, birthday, JSON.stringify(interests), profilePic, JSON.stringify(otherImages), terms_agree, nicfrontImage, nicbackImage, userId];
      
      let updateSql = `
        UPDATE register_steps_user_data
        SET gender = ?, age = ?, birthday = ?, interests = ?, profilePic = ?, otherImages = ?, terms_agree = ?, nicFrontImage = ?, nicBackImage = ?
        WHERE userId = ?
      `;

      if (password) {
        // Hash the new password if it's being updated
        const hashedPassword = await bcrypt.hash(password, 10);
        db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId], (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ message: "Error updating user password" });
          }
        });
      }

      db.query("UPDATE users SET status = ? WHERE id = ?", [userStatus, userId], (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Error updating user status" });
        }
      });

      db.query(updateSql, updateValues, async (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Error updating user details" });
        }

        // Update user portfolio data
        const updatePortfolioSql = `
          UPDATE register_user_portfolio_data
          SET firstName = ?, lastName = ?, whatsAppNumber = ?, job = ?, location = ?, marriageStatus = ?, heightFt = ?, heightIn = ?, weight = ?, address = ?, personalityDescription = ?, alcoholConsumption = ?, lookingFor = ?
          WHERE userId = ?
        `;

        const portfolioValues = [
          firstName,
          lastName,
          whatsAppNumber,
          job,
          location,
          marriageStatus,
          heightFt,
          heightIn,
          weight,
          address,
          personalityDescription,
          alcoholConsumption,
          lookingFor,
          userId,
        ];

        db.query(updatePortfolioSql, portfolioValues, async (portfolioErr, portfolioResult) => {
          if (portfolioErr) {
            console.error(portfolioErr);
            return res.status(500).json({ message: "Error updating user portfolio data" });
          }

          // Update coin balance
          const updateCoinBalanceSql = `
            UPDATE coin_balance
            SET coin_balance = ?
            WHERE userId = ?
          `;

          db.query(updateCoinBalanceSql, [coin_balance, userId], (coinErr, coinResult) => {
            if (coinErr) {
              console.error(coinErr);
              return res.status(500).json({ message: "Error updating coin balance" });
            }

            res.status(200).json({ message: "User updated successfully" });
          });
        });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing request" });
  }
};


const updateuserPackageData = async (req, res) => {
  const userId = req.params.userId;
  const {
    price,
    duration,
    packageStartDate,
    packageEndDate,
    plan_name,
    payment_date,
    payment_status,
  } = req.body;

  try {
    // Construct SQL query to update package data
    const updateSql = `
      UPDATE packagesbuydata
      SET 
        price = ?, 
        duration = ?, 
        packageStartDate = ?, 
        packageStartEnd = ?, 
        plan_name = ?, 
        payment_date = ?, 
        payment_status = ?
      WHERE userId = ?
    `;

    // Prepare values
    const values = [
      price,
      duration,
      packageStartDate,
      packageEndDate,
      plan_name,
      payment_date,
      payment_status,
      userId
    ];

    // Execute SQL query
    db.query(updateSql, values, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error updating package data" });
      }

      res.status(200).json({ message: "Update successful" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing request" });
  }
};


const getHeartsPackages = async (req, res) => {
  try {
    // Query to select all records from the packages table
    const sql = 'SELECT * FROM packages';

    // Execute the SQL query
    db.query(sql, (err, results) => {
      if (err) {
        // Handle SQL query errors
        console.error('Error fetching packages:', err);
        return res.status(500).json({ message: 'Error retrieving users', error: err });
      }

      // Send the results as JSON
      res.status(200).json(results);
    });
  } catch (error) {
    // Handle any other errors
    console.error('Error processing request:', error);
    res.status(500).json({ message: 'Error retrieving users', error });
  }
};

const addHeartsPackage = async (req, res) => {
  const { price, icon_color, heart } = req.body;

  try {
    const insertSql = `
      INSERT INTO packages (price, icon_color, heart)
      VALUES (?, ?, ?)
    `;

    const values = [price, icon_color, heart];

    db.query(insertSql, values, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error adding package" });
      }

      res.status(201).json({ message: "Package added successfully" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing request" });
  }
};


const updateHeartsPackage = async (req, res) => {
  const packageId = req.params.packageId;
  const { price, icon_color, heart } = req.body;

  try {
    const updateSql = `
      UPDATE packages
      SET price = ?, icon_color = ?, heart = ?
      WHERE id = ?
    `;

    const values = [price, icon_color, heart, packageId];

    db.query(updateSql, values, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error updating package" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Package not found" });
      }

      res.status(200).json({ message: "Package updated successfully" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing request" });
  }
};

const deleteHeartsPackage = async (req, res) => {
  const packageId = req.params.packageId;

  try {
    const deleteSql = `
      DELETE FROM packages
      WHERE id = ?
    `;

    db.query(deleteSql, [packageId], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error deleting Heart Package" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Heart Package not found" });
      }

      res.status(200).json({ message: "Heart Package deleted successfully" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing request" });
  }
};

const updateSelectedUserCoinBalance = async (req, res) => {
  const userId = req.params.userId;
  const { newBalance } = req.body;

  try {
    const updateSql = `
      UPDATE coin_balance
      SET coin_balance = ?
      WHERE userId = ?
    `;

    const values = [newBalance, userId];

    db.query(updateSql, values, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Error updating coin_balance" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "coin_balance not found" });
      }

      res.status(200).json({ message: "coin_balance updated successfully" });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing request" });
  }
};



module.exports = {
  addNewUserForAdmin,
  getAllUsers,
  deleteUserData,
  updateUser,
  updateuserPackageData,
  getHeartsPackages,
  addHeartsPackage,
  updateHeartsPackage,
  deleteHeartsPackage,
  updateSelectedUserCoinBalance
};
