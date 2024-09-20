const database = require("../config/db");
const bcrypt = require("bcrypt");
const moment = require("moment-timezone");
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const { verifyToken, getUserData } = require("./UserController");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Set up multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(__dirname, "../uploadsImages", req.params.userId);
    // Create user directory if it doesn't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    // Save the file with the original name or custom name
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

const db = database.connection;

const getAllNewUsers = async (req, res) => {
  try {
    const sql = `
          SELECT 
              u.id AS user_id,
              u.generatedKey,
              u.nic,
              u.online,
              u.status,
              u.created_at,
              u.updated_at,
              rsud.id AS rsud_id,
              rsud.userId AS rsud_userId,
              rsud.gender,
              rsud.age,
              rsud.birthday,
              rsud.interests,
              rsud.profilePic,
              rsud.otherImages,
              rsud.terms_agree,
              rsud.nicFrontImage,
              rsud.nicBackImage,
              rupd.id AS rupd_id,
              rupd.userId AS rupd_userId,
              rupd.firstName,
              rupd.lastName,
              rupd.whatsAppNumber,
              rupd.job,
              rupd.location,
              rupd.marriageStatus,
              rupd.heightFt,
              rupd.heightIn,
              rupd.weight,
              rupd.address,
              rupd.personalityDescription,
              rupd.alcoholConsumption,
              rupd.lookingFor,
              pkbd.price AS packagePrice,
              pkbd.duration AS packageDurationMonth,
              pkbd.packageStartDate,
              pkbd.packageStartEnd AS packageEndDate,
              pkbd.plan_name,
              pkbd.payment_date,
              pkbd.payment_status
          FROM 
              users u
          LEFT JOIN 
              register_steps_user_data rsud ON u.id = rsud.userId
          LEFT JOIN 
              (
                  SELECT * 
                  FROM packagesbuydata pbd
                  WHERE pbd.id IN (SELECT MAX(id) FROM packagesbuydata GROUP BY userId)
              ) pkbd ON u.id = pkbd.userId
          LEFT JOIN 
              register_user_portfolio_data rupd ON u.id = rupd.userId
          WHERE 
              u.status = 0
          ORDER BY 
                u.created_at DESC;   
      `;

    db.query(sql, (err, results) => {
      if (err) {
        console.error("Error retrieving users: ", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      res.status(200).json(results);
    });
  } catch (error) {
    console.error("Error retrieving users:", error);
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
                          return res.status(500).json({
                            message: "Database query error",
                            error: err,
                          });
                        }

                        if (results.length > 0) {
                          await deleteUser(userId);
                          await deleteUserStepsData(userId);
                          // WhatsApp number already exists
                          return res.status(409).json({
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
                              return res.status(500).json({
                                message: "Error inserting user portfolio data",
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

                                  return res.status(500).json({
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
    await deleteUserPortfolioData(userId);
    await deleteUserStepsData(userId);
    await deleteUserPackagesData(userId);
    await deleteUserCoinBalance(userId);
    await deleteFriendships(userId);
    await deleteMessages(userId);
    await deleteUserHarting(userId);
    await deleteUser(userId);

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
    db.query(
      "SELECT * FROM users WHERE id = ?",
      [userId],
      async (err, results) => {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ message: "Error checking user existence" });
        }

        if (results.length === 0) {
          return res.status(404).json({ message: "User not found" });
        }

        // If a new password is provided, hash it
        let updateValues = [
          nic,
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
          JSON.stringify(interests),
          profilePic,
          JSON.stringify(otherImages),
          terms_agree,
          nicfrontImage,
          nicbackImage,
          userId,
        ];

        let updateSql = `
        UPDATE register_steps_user_data
        SET gender = ?, age = ?, birthday = ?, interests = ?, profilePic = ?, otherImages = ?, terms_agree = ?, nicFrontImage = ?, nicBackImage = ?
        WHERE userId = ?
      `;

        if (password) {
          // Hash the new password if it's being updated
          const hashedPassword = await bcrypt.hash(password, 10);
          db.query(
            "UPDATE users SET password = ? WHERE id = ?",
            [hashedPassword, userId],
            (err, result) => {
              if (err) {
                console.error(err);
                return res
                  .status(500)
                  .json({ message: "Error updating user password" });
              }
            }
          );
        }

        db.query(
          "UPDATE users SET status = ? WHERE id = ?",
          [userStatus, userId],
          (err, result) => {
            if (err) {
              console.error(err);
              return res
                .status(500)
                .json({ message: "Error updating user status" });
            }
          }
        );

        db.query(updateSql, updateValues, async (err, result) => {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ message: "Error updating user details" });
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

          db.query(
            updatePortfolioSql,
            portfolioValues,
            async (portfolioErr, portfolioResult) => {
              if (portfolioErr) {
                console.error(portfolioErr);
                return res
                  .status(500)
                  .json({ message: "Error updating user portfolio data" });
              }

              // Update coin balance
              const updateCoinBalanceSql = `
            UPDATE coin_balance
            SET coin_balance = ?
            WHERE userId = ?
          `;

              db.query(
                updateCoinBalanceSql,
                [coin_balance, userId],
                (coinErr, coinResult) => {
                  if (coinErr) {
                    console.error(coinErr);
                    return res
                      .status(500)
                      .json({ message: "Error updating coin balance" });
                  }

                  res
                    .status(200)
                    .json({ message: "User updated successfully" });
                }
              );
            }
          );
        });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing request" });
  }
};

// const updateUserStatus = async (req, res) => {
//   const userId = req.params.userId;
//   const { status } = req.body;

//   const query = 'UPDATE `users` SET `status` = ? WHERE `id` = ?';
//   const values = [status, userId];
//   db.query(query, values, async (err, results) => {
//     if (err) {
//       console.error('Error updating user status:', err);
//       return res.status(500).json({ message: 'Database error', error: err });
//     }
//     if (results.affectedRows === 0) {
//       return res.status(404).json({ message: 'User not found' });
//     }
//     res.status(200).json({ message: 'User status updated successfully' });
//   });
// };

// Function to update user status
const updateUserStatus = async (req, res) => {
  const userId = req.params.userId;
  const { status } = req.body;

  // Only proceed if status == 1
  if (status == 1) {
    // Query to check if profilePic is NULL or an empty string
    const checkProfilePicQuery =
      'SELECT * FROM `register_steps_user_data` WHERE (`profilePic` IS NULL OR `profilePic` = "") AND `userId` = ?';

    db.query(checkProfilePicQuery, [userId], (err, results) => {
      if (err) {
        console.error("Error checking profile picture:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }

      // If no profile picture found, set default 'noProfileImage.png'
      if (results.length > 0) {
        const defaultImage = path.join(__dirname, "../noProfileImage.png");
        const userDir = path.join(__dirname, "../uploadsImages", userId);
        const newImagePath = path.join(userDir, "noProfileImage.png");

        // Create user directory if not exists
        if (!fs.existsSync(userDir)) {
          fs.mkdirSync(userDir, { recursive: true });
        }

        // Copy 'noProfileImage.png' to user's directory
        fs.copyFile(defaultImage, newImagePath, (err) => {
          if (err) {
            console.error("Error copying default image:", err);
            return res
              .status(500)
              .json({ message: "Error setting default profile picture" });
          }

          // Update the database with the correct path to 'noProfileImage.png'
          const profilePicPath = `/user/view/${userId}/noProfileImage.png`;
          const updateProfilePicQuery =
            "UPDATE `register_steps_user_data` SET `profilePic` = ? WHERE `userId` = ?";

          db.query(
            updateProfilePicQuery,
            [profilePicPath, userId],
            (err, results) => {
              if (err) {
                console.error("Error updating profile picture:", err);
                return res
                  .status(500)
                  .json({ message: "Database error", error: err });
              }
              // Proceed with updating user status if status != 1 (no profile image upload)
            }
          );
        });
      }

      const updateQuery = "UPDATE `users` SET `status` = ? WHERE `id` = ?";
      const values = [status, userId];
      db.query(updateQuery, values, (err, results) => {
        if (err) {
          console.error("Error updating user status:", err);
          return res
            .status(500)
            .json({ message: "Database error", error: err });
        }
        if (results.affectedRows === 0) {
          return res.status(404).json({ message: "User not found" });
        }
        return res
          .status(200)
          .json({ message: "User status updated successfully" });
      });
    });
  } else {
    // Proceed with updating user status if status != 1 (no profile image upload)
    const updateQuery = "UPDATE `users` SET `status` = ? WHERE `id` = ?";
    const values = [status, userId];
    db.query(updateQuery, values, (err, results) => {
      if (err) {
        console.error("Error updating user status:", err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      return res
        .status(200)
        .json({ message: "User status updated successfully" });
    });
  }
};

// Function to handle bulk user status updates
// Function to update user statuses in bulk
const updateUserBulkStatuses = async (req, res) => {
  const { users } = req.body;

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: "Invalid user data" });
  }

  try {
    // Loop through each user to check for status and profile picture
    for (const user of users) {
      const { id: userId, status } = user;

      // Only proceed with profilePic check if status == 1
      if (status == 1) {
        const checkProfilePicQuery =
          'SELECT * FROM `register_steps_user_data` WHERE (`profilePic` IS NULL OR `profilePic` = "") AND `userId` = ?';

        // Await for each DB query using a promise
        const profileCheckResult = await new Promise((resolve, reject) => {
          db.query(checkProfilePicQuery, [userId], (err, results) => {
            if (err) return reject(err);
            resolve(results);
          });
        });

        // If no profile picture found, upload the default image
        if (profileCheckResult.length > 0) {
          const defaultImage = path.join(__dirname, "../noProfileImage.png");
          const userDir = path.join(__dirname, "../uploadsImages", `${userId}`);
          const newImagePath = path.join(userDir, "noProfileImage.png");

          // Create user directory if it doesn't exist
          if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
          }

          // Copy default image to user's directory
          await new Promise((resolve, reject) => {
            fs.copyFile(defaultImage, newImagePath, (err) => {
              if (err) return reject(err);
              resolve();
            });
          });

          // Update the database with the default profile picture path
          const profilePicPath = `/user/view/${userId}/noProfileImage.png`;
          const updateProfilePicQuery =
            "UPDATE `register_steps_user_data` SET `profilePic` = ? WHERE `userId` = ?";

          await new Promise((resolve, reject) => {
            db.query(
              updateProfilePicQuery,
              [profilePicPath, userId],
              (err, results) => {
                if (err) return reject(err);
                resolve(results);
              }
            );
          });
        }
      }

      // Proceed with updating the user's status
      const updateQuery = "UPDATE `users` SET `status` = ? WHERE `id` = ?";
      const values = [status, userId];

      await new Promise((resolve, reject) => {
        db.query(updateQuery, values, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    }

    // If everything was successful, return a success message
    res.status(200).json({ message: "User statuses updated successfully" });
  } catch (err) {
    console.error("Error updating user statuses:", err);
    res.status(500).json({ message: "Database error", error: err });
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
      userId,
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
    const sql = "SELECT * FROM packages";

    // Execute the SQL query
    db.query(sql, (err, results) => {
      if (err) {
        // Handle SQL query errors
        console.error("Error fetching packages:", err);
        return res
          .status(500)
          .json({ message: "Error retrieving users", error: err });
      }

      // Send the results as JSON
      res.status(200).json(results);
    });
  } catch (error) {
    // Handle any other errors
    console.error("Error processing request:", error);
    res.status(500).json({ message: "Error retrieving users", error });
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
        return res
          .status(500)
          .json({ message: "Error deleting Heart Package" });
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

const getsubscriptionPlansForAdmin = async (req, res) => {
  const sql = "SELECT * FROM subscription_plans";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching subscription plans:", err);
      return res
        .status(500)
        .json({ message: "Error fetching subscription plans" });
    }

    // Process the results to convert integer values and parse JSON
    const processedResults = results.map((plan) => ({
      ...plan,
      discount: plan.discount === 1, // Convert integer to boolean
      features: JSON.parse(plan.features), // Parse JSON string to object
    }));

    res.status(200).json(processedResults);
  });
};

// Add a new subscription plan
const addSubscriptionPlan = (req, res) => {
  const {
    planName,
    price,
    discount,
    discountPercentage,
    discountShowValue,
    features,
  } = req.body;

  // Convert boolean to integer for database storage
  const discountInt = discount ? 1 : 0;

  // Convert features object to JSON string
  const featuresJson = JSON.stringify(features);

  const sql =
    "INSERT INTO subscription_plans (plan_name, price, discount, discount_percentage, discount_show_value, features) VALUES (?, ?, ?, ?, ?, ?)";

  db.query(
    sql,
    [
      planName,
      price,
      discountInt,
      discountPercentage,
      discountShowValue,
      featuresJson,
    ],
    (err, results) => {
      if (err) {
        console.error("Error adding subscription plan:", err);
        return res
          .status(500)
          .json({ message: "Error adding subscription plan" });
      }

      res.status(201).json({
        message: "Subscription plan added successfully",
        id: results.insertId,
      });
    }
  );
};

// Update a subscription plan
const updateSubscriptionPlan = (req, res) => {
  const { id } = req.params;
  const {
    planName,
    price,
    discount,
    discountPercentage,
    discountShowValue,
    features,
  } = req.body;

  // Convert boolean to integer for database storage
  const discountInt = discount ? 1 : 0;

  // Convert features object to JSON string
  const featuresJson = JSON.stringify(features);

  const sql =
    "UPDATE subscription_plans SET plan_name = ?, price = ?, discount = ?, discount_percentage = ?, discount_show_value = ?, features = ? WHERE id = ?";

  db.query(
    sql,
    [
      planName,
      price,
      discountInt,
      discountPercentage,
      discountShowValue,
      featuresJson,
      id,
    ],
    (err, results) => {
      if (err) {
        console.error("Error updating subscription plan:", err);
        return res
          .status(500)
          .json({ message: "Error updating subscription plan" });
      }

      res
        .status(200)
        .json({ message: "Subscription plan updated successfully" });
    }
  );
};

// Delete a subscription plan
const deleteSubscriptionPlan = (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM subscription_plans WHERE id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error deleting subscription plan:", err);
      return res
        .status(500)
        .json({ message: "Error deleting subscription plan" });
    }

    res.status(200).json({ message: "Subscription plan deleted successfully" });
  });
};

const getPendingPackagespayments = async (req, res) => {
  const query = `
    SELECT p.*, r.firstName, r.lastName, r.whatsAppNumber
    FROM packagesbuydata p
    LEFT JOIN register_user_portfolio_data r ON p.userId = r.userId
    WHERE p.payment_status = 0 AND p.approved = 0
    ORDER BY p.created_at DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching pending packages:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    // Send the results back to the client
    res.status(200).json({ message: 'Pending packages fetched successfully', data: results });
  });
};

// Define the async function for handling pending package payments
const getSubcriptionPackagesForPendingPackagesPayments = async (req, res) => {
  try {
      const { plan_name } = req.body; // Read from req.body instead of req.query

      if (!plan_name) {
          return res.status(400).json({ error: 'Missing body parameter: plan_name' });
      }

      // Sanitize input to prevent SQL injection
      const query = 'SELECT * FROM subscription_plans WHERE plan_name LIKE ?';
      const values = [`%${plan_name}%`];

      // Promisify the query to use async/await
      const queryAsync = (query, values) => {
          return new Promise((resolve, reject) => {
              db.query(query, values, (err, results) => {
                  if (err) {
                      return reject(err);
                  }
                  resolve(results);
              });
          });
      };

      // Execute the query
      const results = await queryAsync(query, values);
      res.json(results);
  } catch (error) {
      console.error('Query error:', error);
      res.status(500).json({ error: 'Database query error' });
  }
};

const approveOrRejectPendingPackagesPayments = async (req, res) => {
  const {
      id,
      userId,
      status,
      price,
      duration,
      packageStartDate,
      packageEndDate,
      payment_date,
      approved
  } = req.body;

  try {
      // Validate required fields
      if (!userId || !id) {
          return res.status(400).json({ message: 'User ID and ID are required' });
      }

            // Log the original input values
            console.log('Original packageStartDate:', packageStartDate);
            console.log('Original packageEndDate:', packageEndDate);
      
            // Assume the incoming dates are in UTC; change this if the input is in a different time zone
            const inputTimeZone = 'UTC'; // Replace 'UTC' if the input dates are in a different time zone
            const targetTimeZone = 'Asia/Colombo'; // Set your desired time zone for storage
      
            // Convert packageStartDate and packageEndDate to the target time zone
            const formattedStartDate = moment.tz(packageStartDate, inputTimeZone).tz(targetTimeZone).format('YYYY-MM-DD HH:mm:ss');
            const formattedEndDate = moment.tz(packageEndDate, inputTimeZone).tz(targetTimeZone).format('YYYY-MM-DD HH:mm:ss');
      
            // Log the converted values
            console.log('Converted packageStartDate:', formattedStartDate);
            console.log('Converted packageEndDate:', formattedEndDate);

      // Prepare the SQL query
      const sql = `
          UPDATE packagesbuydata
          SET 
              price = ?,
              duration = ?,
              packageStartDate = ?,
              packageStartEnd = ?,
              payment_date = ?,
              payment_status = ?,
              approved = ?
          WHERE id = ?`;

      // Execute the query with the provided parameters
      const result = await db.query(sql, [
          price,
          duration,
          formattedStartDate,
          formattedEndDate,
          payment_date,
          status,
          approved,
          id
      ]);



      // If using mysql2, access affectedRows directly
      if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Payment record not found' });
      }

      return res.status(200).json({ message: 'Payment status updated successfully' });
  } catch (error) {
      console.error('Error updating payment status:', error);
      return res.status(500).json({ message: 'Internal server error' });
  }
};


module.exports = {
  addNewUserForAdmin,
  getAllNewUsers,
  deleteUserData,
  updateUser,
  updateUserStatus,
  updateuserPackageData,
  getHeartsPackages,
  addHeartsPackage,
  updateHeartsPackage,
  deleteHeartsPackage,
  updateSelectedUserCoinBalance,
  getsubscriptionPlansForAdmin,
  deleteSubscriptionPlan,
  updateSubscriptionPlan,
  addSubscriptionPlan,
  updateUserBulkStatuses,
  getPendingPackagespayments,
  getSubcriptionPackagesForPendingPackagesPayments,
  approveOrRejectPendingPackagesPayments
};
