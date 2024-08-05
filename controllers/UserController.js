const database = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs-extra");
const path = require("path");

const db = database.connection;

function verifyToken(token) {
  try {
    // Remove the "Bearer " prefix from the token
    const tokenWithoutBearer = token.replace("Bearer ", "");
    const decoded = jwt.verify(tokenWithoutBearer, "lovebrids2024");
    return decoded;
  } catch (err) {
    return null;
  }
}

const register = async (req, res) => {
  // Extract NIC number and password from the request body
  const { nic, password } = req.body;

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
          return res.status(500).send("Error registering user");
        }

        // If NIC already exists, send response
        if (results.length > 0) {
          return res.status(400).send("User with this NIC already exists");
        }

        // Insert user into the database
        db.query(
          "INSERT INTO users (nic, password) VALUES (?, ?)",
          [nic, hashedPassword],
          (err, results) => {
            if (err) {
              console.error(err);
              return res.status(500).send("Error registering user");
            }

            // Retrieve the newly inserted user data
            db.query(
              "SELECT * FROM users WHERE nic = ?",
              [nic],
              (err, userResults) => {
                if (err) {
                  console.error(err);
                  return res.status(500).send("Error retrieving user data");
                }

                // Generate JWT token
                const token = jwt.sign({ nic: nic }, "lovebrids2024");

                // Send response with user data and token
                res.status(200).json({
                  message: "User registered successfully",
                  token: token,
                  user: userResults[0], // Assuming the user data is in the first result
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("Error registering user");
  }
};

const getUser = async (req, res) => {
  // Extract token from the request headers
  const token = req.headers.authorization;

  // Verify the token (replace with your token verification logic)
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Retrieve user data based on the NIC number (using await)
    const userData = await getUserData(decoded.nic);
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }
    // Send user data in the response
    res.json(userData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error retrieving user data" });
  }
};

const getUserData = (nic) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT 
    u.*,
    rsud.id AS rsud_id,
    rsud.userId AS rsud_userId,
    rsud.gender,
    rsud.age,
    rsud.birthday,
    rsud.interests,
    rsud.profilePic,
    rsud.otherImages,
    rsud.nicFrontImage,
    rsud.nicBackImage,
    rsud.terms_agree,
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
    pkbd.id AS paymentId,
    pkbd.price,
    pkbd.duration,
    pkbd.packageStartDate,
    pkbd.packageStartEnd,
    pkbd.plan_name,
    pkbd.payment_date,
    pkbd.payment_status,
    pkbd.created_at
FROM 
    users u
LEFT JOIN 
    register_steps_user_data rsud ON u.id = rsud.userId
LEFT JOIN 
    register_user_portfolio_data rupd ON u.id = rupd.userId
LEFT JOIN 
    packagesbuydata pkbd ON u.id = pkbd.userId
    AND pkbd.payment_date = (
        SELECT MAX(payment_date)
        FROM packagesbuydata
        WHERE userId = u.id
    )
WHERE 
    u.nic = ?`;
    // Query the database to retrieve user data based on the NIC number
    db.query(sql, [nic], (err, results) => {
      if (err) {
        console.error(err);
        reject(err); // Reject with the error object
      } else {
        // If user data is found, resolve the promise with the user data
        if (results.length > 0) {
          resolve(results[0]);
        } else {
          // If user data is not found, reject with a specific message
          reject("User not found");
        }
      }
    });
  });
};

const login = async (req, res) => {
  // Extract nic (or NIC) and password from the request body
  const { nic, password } = req.body;

  try {
    // Query the database to find user by nic (or NIC)
    const userData = await getUserData(nic);

    if (!userData) {
      return res.status(401).json({ message: "Invalid nic or password" });
    }

    const user = userData;

    // Compare hashed password with the provided password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid Password" });
    }

    // Generate JWT token on successful login
    const token = jwt.sign({ nic: user.nic }, "lovebrids2024");

    // Send response with token
    console.log(token);
    res.status(200).json({ message: "Login successful", token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error logging in" });
  }
};

const sendmessage = async (req, res) => {
  // Extract nic (or NIC) and password from the request body
  const { id, message, senderId, status } = req.body;
  console.error(message);
};

const getFriendsList = async (req, res) => {
  const userId = req.params.userId; // Extract user ID from request parameters

  // Define the SQL query to retrieve friend IDs for the given user ID
  const friendsSql = `
  SELECT DISTINCT  
  users.*, register_user_portfolio_data.firstName, register_user_portfolio_data.lastName, register_steps_user_data.profilePic
  FROM users 
  JOIN friendships ON users.id = friendships.friend_id OR users.id = friendships.user_id 
  JOIN register_user_portfolio_data ON users.id = register_user_portfolio_data.userId 
  JOIN register_steps_user_data ON users.id = register_steps_user_data.userId 
  WHERE (friendships.user_id = ? OR friendships.friend_id = ?) AND users.id != ?
  `;

  // Execute the SQL query to get friend IDs
  db.query(
    friendsSql,
    [userId, userId, userId],
    async (err, friendsResults) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal server error" });
      }

      // Array to store promises for fetching last messages
      const lastMessagesPromises = [];

      // Loop through each friend
      for (const friend of friendsResults) {
        // Define the SQL query to retrieve the last message for the current friend
        const lastMessageSql = `
        SELECT *
        FROM messages
        WHERE (sender_id = ? AND receiverId = ?) OR (sender_id = ? AND receiverId = ?)
        ORDER BY created_at DESC
        LIMIT 1
      `;

        // Execute the SQL query to get the last message for the current friend
        const promise = new Promise((resolve, reject) => {
          db.query(
            lastMessageSql,
            [userId, friend.id, friend.id, userId],
            (err, messageResult) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                resolve({ friend, lastMessage: messageResult[0] });
              }
            }
          );
        });

        // Push the promise into the array
        lastMessagesPromises.push(promise);
      }

      try {
        // Wait for all promises to resolve
        const lastMessagesResults = await Promise.all(lastMessagesPromises);

        // If the query was successful, send the combined results as a JSON response

        res.json(lastMessagesResults);
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  );
};

const getMessagessList = async (req, res) => {
  const userId = req.params.userId; // Extract user ID from request parameters

  // Define the SQL query to get the latest messages
  const messagesSql = `
    SELECT m.*
FROM messages m
INNER JOIN (
  SELECT room_name, MAX(id) AS max_id
  FROM messages
  WHERE sender_id = ? OR receiverId = ?
  GROUP BY room_name
) latest
ON m.id = latest.max_id
WHERE m.sender_id = ? OR m.receiverId = ?
`;

  try {
    // Execute the query to get the latest messages
    db.query(
      messagesSql,
      [userId, userId, userId, userId],
      async (err, messagesResults) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Collect user details promises
        const userDetailsPromises = messagesResults
          .filter(
            (message) =>
              message.receiverId != userId || message.sender_id != userId
          )
          .map((message) => {
            const friendId =
              message.receiverId != userId
                ? message.receiverId
                : message.sender_id;
            console.log(friendId);
            const userSql = `
            SELECT DISTINCT  
              users.*, 
              register_user_portfolio_data.firstName, 
              register_user_portfolio_data.lastName,
              register_steps_user_data.profilePic
            FROM users 
            JOIN register_user_portfolio_data ON users.id = register_user_portfolio_data.userId 
            JOIN register_steps_user_data ON users.id = register_steps_user_data.userId 
            WHERE users.id = ?
          `;
            return new Promise((resolve, reject) => {
              db.query(userSql, [friendId], (err, userResults) => {
                if (err) {
                  return reject(err);
                }

                resolve({
                  friend: userResults[0],
                  lastMessage: {
                    id: message.id,
                    messageId: message.messageId,
                    room_name: message.room_name,
                    sender_id: message.sender_id,
                    receiverId: message.receiverId,
                    message: message.message,
                    status: message.status,
                    created_at: message.created_at,
                  },
                }); // Assuming one result per user
              });
            });
          });

        try {
          const messages = await Promise.all(userDetailsPromises);
          return res.json(messages);
        } catch (userDetailsError) {
          console.error("Error fetching user details:", userDetailsError);
          return res.status(500).json({ error: "Internal server error" });
        }
      }
    );
  } catch (err) {
    console.error("Error executing query:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const getHartingList = async (req, res) => {
  try {
    const userId = req.params.userId; // Extract user ID from request parameters

    // Define the SQL query to retrieve friend IDs for the given user ID
    const hartingsSql = `SELECT DISTINCT  users.nic, users.online, register_user_portfolio_data.firstName, register_user_portfolio_data.lastName, register_steps_user_data.profilePic, register_steps_user_data.age, register_steps_user_data.gender,  hart.id AS hartingId, hart.friend_id, hart.is_harting, hart.created_at
   FROM users 
   JOIN user_harting hart ON users.id = hart.friend_id
   JOIN register_user_portfolio_data ON users.id = register_user_portfolio_data.userId 
   JOIN register_steps_user_data ON users.id = register_steps_user_data.userId 
   WHERE hart.user_id = ? AND hart.is_harting = 1`;

    // Execute the SQL query to get friend IDs
    db.query(hartingsSql, [userId], async (err, hartingResults) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.status(200).json(hartingResults);
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const register_steps_user_data = async (userId, data) => {
  const {
    gender,
    age,
    birthday,
    interests,
    profilePic,
    otherImages,
    terms_agree,
  } = data;
  const interestsnew = interests != "null" ? interests : "[]";
  const checkSql = "SELECT * FROM register_steps_user_data WHERE userId = ?";
  db.query(checkSql, [userId], (checkErr, checkResults) => {
    if (checkErr) {
      console.error(checkErr);
      return;
    }
    const updateValues = [
      gender,
      age,
      birthday,
      interestsnew,
      profilePic,
      JSON.stringify(otherImages),
      terms_agree,
      userId,
    ];

    if (checkResults.length > 0) {
      const updateSql = `UPDATE register_steps_user_data SET 
                           gender = ?, age = ?, birthday = ?, interests = ?, 
                           profilePic = ?, otherImages = ?, terms_agree = ?
                         WHERE userId = ?`;

      db.query(updateSql, updateValues, (updateErr) => {
        if (updateErr) {
          console.error(updateErr);
        }
      });
    } else {
      const insertSql = `INSERT INTO register_steps_user_data (userId, gender, age, birthday, interests, profilePic, otherImages, terms_agree)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

      const insertValues = [
        userId,
        gender,
        age,
        birthday,
        interestsnew,
        profilePic,
        JSON.stringify(otherImages),
        terms_agree,
      ];

      db.query(insertSql, insertValues, (insertErr) => {
        if (insertErr) {
          console.error(insertErr);
        }
      });
    }
  });
};

// const register_steps_user_data = async (req, res) => {
//   console.log(req.body);
//   try {
//     const token = req.headers.authorization;
//     const decoded = verifyToken(token);
//     if (!decoded) {
//       return res.status(401).json({ message: "Unauthorized" });
//     }

//     const userData = await getUserData(decoded.nic);
//     if (!userData) {
//       return res.status(404).json({ message: "User not found" });
//     }
//     const userId = userData["id"];

//     // Extract remaining data from the request body
//     const { gender, age, birthday, interests, terms_agree } = req.body;
//     const profilePic = req.files.profilePic ? req.files.profilePic[0].path : null;
//     const otherImages = req.files.otherImages ? req.files.otherImages.map(file => file.path) : [];

//     const checkSql = "SELECT * FROM register_steps_user_data WHERE userId = ?";
//     db.query(checkSql, [userId], (checkErr, checkResults) => {
//       if (checkErr) {
//         console.error(checkErr);
//         return res.status(500).send("Error checking user data");
//       }

//       if (checkResults.length > 0) {
//         const updateSql = `UPDATE register_steps_user_data SET
//                              gender = ?, age = ?, birthday = ?, interests = ?,
//                              profilePic = ?, otherImages = ?, terms_agree = ?
//                            WHERE userId = ?`;

//         const updateValues = [
//           gender,
//           age,
//           birthday,
//           JSON.stringify(interests),
//           profilePic,
//           JSON.stringify(otherImages),
//           terms_agree,
//           userId,
//         ];

//         db.query(updateSql, updateValues, (updateErr, updateResult) => {
//           if (updateErr) {
//             console.error(updateErr);
//             return res.status(500).send("Error updating user data");
//           }
//           return res.status(200).json({ message: "User data updated successfully" });
//         });
//       } else {
//         const insertSql = `INSERT INTO register_steps_user_data (userId, gender, age, birthday, interests, profilePic, otherImages, terms_agree)
//                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

//         const insertValues = [
//           userId,
//           gender,
//           age,
//           birthday,
//           JSON.stringify(interests),
//           profilePic,
//           JSON.stringify(otherImages),
//           terms_agree,
//         ];

//         db.query(insertSql, insertValues, (insertErr, insertResult) => {
//           if (insertErr) {
//             console.error(insertErr);
//             return res.status(500).send("Error inserting user data");
//           }
//           return res.status(200).json({ message: "User data inserted successfully" });
//         });
//       }
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "An error occurred. Please try again." });
//   }
// };

// const register_steps_user_data = async (req, res) => {
//   // Extract token from the request headers
//   const token = req.headers.authorization;

//   // Verify the token
//   const decoded = verifyToken(token);
//   if (!decoded) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }

//   const userData = await getUserData(decoded.nic);
//   if (!userData) {
//     return res.status(404).json({ message: "User not found" });
//   }
//   const userId = userData["id"];

//   // Extract the remaining data from the request body
//   const { gender, age, birthday, interests, profilePic, otherImages } =
//     req.body;
//   // Check if the userId already exists in the table
//   const checkSql = "SELECT * FROM register_steps_user_data WHERE userId = ?";
//   db.query(checkSql, [userId], (checkErr, checkResults) => {
//     if (checkErr) {
//       console.error(checkErr);
//       return res.status(500).send("Error checking user data");
//     }

//     // If userId exists, update the record
//     if (checkResults.length > 0) {
//       const updateSql = `UPDATE register_steps_user_data SET
//                            gender = ?, age = ?, birthday = ?, interests = ?,
//                            profilePic = ?, otherImages = ?, terms_agree = ?
//                          WHERE userId = ?`;

//       const updateValues = [
//         gender,
//         age,
//         birthday,
//         JSON.stringify(interests), // Convert interests to JSON string
//         profilePic,
//         JSON.stringify(otherImages), // Convert otherImages to JSON string
//         0,
//         userId,
//       ];

//       db.query(updateSql, updateValues, (updateErr, updateResult) => {
//         if (updateErr) {
//           console.error(updateErr);
//           return res.status(500).send("Error updating user data");
//         }
//         // Send success response
//         return res
//           .status(200)
//           .json({ message: "User data updated successfully" });
//       });
//     } else {
//       // If userId does not exist, insert a new record
//       const insertSql = `INSERT INTO register_steps_user_data (userId, gender, age, birthday, interests, profilePic, otherImages, terms_agree)
//                          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

//       const insertValues = [
//         userId,
//         gender,
//         age,
//         birthday,
//         JSON.stringify(interests), // Convert interests to JSON string
//         profilePic,
//         JSON.stringify(otherImages), // Convert otherImages to JSON string
//         0,
//       ];

//       db.query(insertSql, insertValues, (insertErr, insertResult) => {
//         if (insertErr) {
//           console.error(insertErr);
//           return res.status(500).send("Error inserting user data");
//         }
//         // Send success response
//         return res
//           .status(200)
//           .json({ message: "User data inserted successfully" });
//       });
//     }
//   });
// };

const update_user_nic_images = async (userId, { frontImage, backImage }) => {
  const sql = `UPDATE register_steps_user_data SET nicFrontImage = ?, nicBackImage = ? WHERE userId = ?`;

  return new Promise((resolve, reject) => {
    db.query(sql, [frontImage, backImage, userId], (err, result) => {
      if (err) {
        console.error(err);
        return reject(new Error("Database error"));
      }

      if (result.affectedRows === 0) {
        return reject(new Error("User not found"));
      }

      resolve("User NIC data updated successfully");
    });
  });
};

const user_terms_agree = async (req, res) => {
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

  const { terms_agree } = req.body;

  if (terms_agree !== 1) {
    return res.status(400).json({ message: "Invalid terms agreement value" });
  }

  const sql = `UPDATE register_steps_user_data SET terms_agree = ? WHERE userId = ?`;
  db.query(sql, [terms_agree, userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Terms agreement updated successfully" });
  });
};

const register_user_portfolio_data = async (req, res) => {
  try {
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

    const formData = req.body;
    const pno = formData.whatsAppNumber;

    // Check if the WhatsApp number already exists in the register_user_portfolio_data table
    const checkQueryfirst =
      "SELECT * FROM register_user_portfolio_data WHERE whatsAppNumber = ?";
    db.query(checkQueryfirst, [pno], (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      if (results.length > 0) {
        return res.status(409).send("WhatsApp number already exists");
      } else {
        // Record does not exist, perform insert
        const insertQuery = `
          INSERT INTO register_user_portfolio_data (
            userId, firstName, lastName, whatsAppNumber, job, location, marriageStatus, heightFt, heightIn, weight, address, personalityDescription, alcoholConsumption, lookingFor
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertValues = [
          userId,
          formData.firstName,
          formData.lastName,
          formData.whatsAppNumber,
          formData.job,
          formData.location,
          formData.marriageStatus,
          formData.heightFt,
          formData.heightIn,
          formData.weight,
          formData.address,
          formData.personalityDescription,
          formData.alcoholConsumption,
          formData.lookingFor,
        ];

        db.query(insertQuery, insertValues, (insertErr, insertResult) => {
          if (insertErr) {
            console.error("Error inserting data: ", insertErr);
            return res.status(500).send("Error inserting data");
          }
          console.log("Data inserted successfully");
          return res.status(200).send("Data inserted successfully");
        });
      }
    });
  } catch (e) {
    console.log(e);
  }
};

const update_register_user_portfolio_data = async (req, res) => {
  try {
    // Extract token from the request headers
    const token = req.headers.authorization;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const userData = await getUserData(decoded.nic);
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userData.id;
    const formData = req.body;

    // Update user portfolio data
    const updateQuery = `
      UPDATE register_user_portfolio_data 
      SET 
        firstName = ?,
        lastName = ?,
        whatsAppNumber = ?,
        job = ?,
        location = ?,
        marriageStatus = ?,
        heightFt = ?,
        heightIn = ?,
        weight = ?,
        address = ?,
        personalityDescription = ?,
        alcoholConsumption = ?,
        lookingFor = ?
      WHERE userId = ?
    `;

    const updateValues = [
      formData.firstName,
      formData.lastName,
      formData.whatsAppNumber,
      formData.job,
      formData.location,
      formData.marriageStatus,
      formData.heightFt,
      formData.heightIn,
      formData.weight,
      formData.address,
      formData.personalityDescription,
      formData.alcoholConsumption,
      formData.lookingFor,
      userId,
    ];

    db.query(updateQuery, updateValues, (updateErr, updateResult) => {
      if (updateErr) {
        console.error("Error updating data: ", updateErr);
        return res
          .status(500)
          .json({ message: "Internal Server Error: Error updating data" });
      }
      if (updateResult.affectedRows === 0) {
        return res.status(404).json({ message: "User portfolio not found" });
      }
      console.log("Data updated successfully");
      return res.status(200).json({ message: "Data updated successfully" });
    });
  } catch (error) {
    console.error("Unexpected error: ", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getUserRegisterData = (userId) => {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT * FROM register_steps_user_data WHERE userId = ?",
      [userId],
      (err, results) => {
        if (err) {
          console.error(err);
          reject(err); // Reject with the error object
        } else {
          if (results.length > 0) {
            resolve(results[0]);
          } else {
            reject("Register data not found");
          }
        }
      }
    );
  });
};

const getAllUsersToHomepage = async (req, res) => {
  try {
    const token = req.headers.authorization;
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userData = await getUserData(decoded.nic);
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }
    const userId = userData.id;
    const registerData = await getUserRegisterData(userId);
    const userGender = registerData.gender;

    const query = req.query.query || "";
    const generatedKey = req.query.generatedKey || "";
    const plan_name = req.query.plan_name || "";
    const payment_status = req.query.payment_status || "";
    const location = req.query.location || "";
    const weight = req.query.weight || "";
    const height = req.query.height || "";
    const marriageStatus = req.query.marriageStatus || "";
    const age = req.query.age || "";
    const limit = parseInt(req.query.limit) || 15; // Default limit to 15 if not provided
    const offset = parseInt(req.query.offset) || 0; // Default offset to 0 if not provided

    let ageLowerBound = "";
    let ageUpperBound = "";

    if (age) {
      const ageRange = age.split(" - ");
      if (ageRange.length === 2) {
        ageLowerBound = parseFloat(ageRange[0]);
        ageUpperBound = parseFloat(ageRange[1]);
      }
    }

    const heightParts = height.split(" - ");
    let firstHeightFt = 0,
      firstHeightIn = 0,
      secondHeightFt = 0,
      secondHeightIn = 0;

    if (heightParts.length === 2) {
      const firstHeight = heightParts[0].split(" ");
      const firstFtIn = firstHeight[0].split(".");
      firstHeightFt = parseInt(firstFtIn[0]);
      firstHeightIn = parseInt(firstFtIn[1]) || 0;

      const secondHeight = heightParts[1].split(" ");
      const secondFtIn = secondHeight[0].split(".");
      secondHeightFt = parseInt(secondFtIn[0]);
      secondHeightIn = parseInt(secondFtIn[1]) || 0;
    }

    const sql = `
    SELECT 
    COALESCE(f.status, 'not friends') AS isFriendValue,
    COALESCE(f.status, 'not friends') AS isFriend,
    hart.is_harting AS isHarting,
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
    pkbd.price as packagePrice,
    pkbd.duration as packageDurationMonth,
    pkbd.packageStartDate,
    pkbd.packageStartEnd as packageEndDate,
    pkbd.plan_name,
    pkbd.payment_date,
    pkbd.payment_date,
    pkbd.payment_status
    FROM 
    users u
    LEFT JOIN 
    register_steps_user_data rsud ON u.id = rsud.userId
    LEFT JOIN 
    packagesbuydata pkbd ON u.id = pkbd.userId
    LEFT JOIN 
    friendships f ON u.id = f.friend_id AND f.user_id = ?
    LEFT JOIN 
    user_harting hart ON u.id = hart.friend_id AND hart.user_id = ?
    LEFT JOIN 
    register_user_portfolio_data rupd ON u.id = rupd.userId
    WHERE 
    u.id != ? AND rsud.gender != ? AND u.status = 1 AND
    (u.nic LIKE ? OR rsud.interests LIKE ? OR rupd.firstName LIKE ? OR rupd.lastName LIKE ?)
    ${location ? "AND rupd.location LIKE ?" : ""}
    ${generatedKey ? "AND u.generatedKey LIKE ?" : ""}
    ${plan_name ? "AND pkbd.plan_name LIKE ?" : ""}
    ${payment_status ? "AND pkbd.payment_status LIKE ?" : ""}
    ${weight ? "AND rupd.weight LIKE ?" : ""}
    ${
      heightParts.length === 2
        ? `
      AND (rupd.heightFt > ? OR (rupd.heightFt = ? AND rupd.heightIn >= ?))
      AND (rupd.heightFt < ? OR (rupd.heightFt = ? AND rupd.heightIn <= ?))
    `
        : ""
    }
    ${marriageStatus ? "AND rupd.marriageStatus LIKE ?" : ""}
    ${age ? "AND rsud.age >= ? AND rsud.age <= ?" : ""}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
    `;

    let queryParams = [
      userId,
      userId,
      userId,
      userGender,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
    ];

    if (location) queryParams.push(`%${location}%`);
    if (generatedKey) queryParams.push(`%${generatedKey}%`);
    if (plan_name) queryParams.push(`%${plan_name}%`);
    if (payment_status) queryParams.push(`%${payment_status}%`);
    if (weight) queryParams.push(weight);
    if (heightParts.length === 2) {
      queryParams.push(
        firstHeightFt,
        firstHeightFt,
        firstHeightIn,
        secondHeightFt,
        secondHeightFt,
        secondHeightIn
      );
    }
    if (marriageStatus) queryParams.push(`%${marriageStatus}%`);
    if (age) {
      queryParams.push(ageLowerBound, ageUpperBound);
    }
    queryParams.push(limit, offset);

    db.query(sql, queryParams, (err, results) => {
      if (err) {
        console.error("Error retrieving users: ", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      res.status(200).json(results);
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUserFriendsPendinglistData = async (req, res) => {
  const token = req.headers.authorization;
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userData = await getUserData(decoded.nic);
  if (!userData) {
    return res.status(404).json({ message: "User not found" });
  }
  const userId = userData.id;

  const sql = `SELECT 
  u.online,
  rsud.profilePic,
  rupd.firstName,
  rupd.lastName,
  friends.*
FROM 
  users u
LEFT JOIN 
  register_steps_user_data rsud ON u.id = rsud.userId
  LEFT JOIN 
  friendships friends ON u.id = friends.user_id
LEFT JOIN 
  register_user_portfolio_data rupd ON u.id = rupd.userId
  WHERE 
  friends.friend_id = ? AND friends.status = ?`;

  try {
    db.query(sql, [userId, "pending"], (err, results) => {
      if (err) {
        console.error("Error retrieving users: ", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      res.status(200).json(results);
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUserFriendslistData = async (req, res) => {
  const token = req.headers.authorization;
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userData = await getUserData(decoded.nic);
  if (!userData) {
    return res.status(404).json({ message: "User not found" });
  }
  const userId = userData.id;

  const sql = `SELECT 
  u.online,
  rsud.profilePic,
  rupd.firstName,
  rupd.lastName,
  friends.*
FROM 
  users u
LEFT JOIN 
  register_steps_user_data rsud ON u.id = rsud.userId
  LEFT JOIN 
  friendships friends ON u.id = friends.friend_id
LEFT JOIN 
  register_user_portfolio_data rupd ON u.id = rupd.userId
  WHERE 
  friends.user_id = ? AND friends.status != ?`;

  try {
    db.query(sql, [userId, "unfriend"], (err, results) => {
      if (err) {
        console.error("Error retrieving users: ", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      res.status(200).json(results);
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    res.status(200).json("users");
  } catch (error) {
    res.status(500).json({ message: "Error retrieving users", error });
  }
};

// const updateProfilePic = async (req, res) => {
//   const { userId } = req.params;
//   const { profilePic } = req.body;

//   if (!userId || !profilePic) {
//     return res.status(400).json({ message: "Missing userId or profilePic" });
//   }

//   try {
//     const sql =
//       "UPDATE register_steps_user_data SET profilePic = ? WHERE userId = ?";
//     const values = [profilePic, userId];

//     db.query(sql, values, (err, results) => {
//       if (err) {
//         console.error("Error updating profile picture:", err);
//         return res
//           .status(500)
//           .json({ message: "Error updating profile picture" });
//       }

//       if (results.affectedRows === 0) {
//         return res.status(404).json({ message: "User not found" });
//       }

//       res.status(200).json({ message: "Profile picture updated successfully" });
//     });
//   } catch (error) {
//     console.error("Unexpected error:", error);
//     res.status(500).json({ message: "Unexpected error occurred" });
//   }
// };

const updateProfilePic = async (userId, updateData) => {
  try {
    // Assuming you have a table named 'users' with a column 'profilePic'
    const result = await db.query(
      "UPDATE register_steps_user_data SET profilePic = ? WHERE userId = ?",
      [updateData.profilePic, userId]
    );

    // Check if the update was successful
    if (result.affectedRows > 0) {
      return { success: true, message: "Profile picture updated successfully" };
    } else {
      return { success: false, message: "Failed to update profile picture" };
    }
  } catch (error) {
    console.error("Error updating profile picture:", error);
    throw new Error("Internal server error");
  }
};

const deleteUserData = async (req) => {
  const token = req.headers.authorization;
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userData = await getUserData(decoded.nic);
  if (!userData) {
    return res.status(404).json({ message: "User not found" });
  }
  const userId = userData.id;

  try {
    await deleteUserImageFolder(userId);
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

const deleteUserImageFolder = async (userId) => {
  try {
    const userDir = path.join(__dirname, "../uploadsImages", userId.toString());
    if (fs.existsSync(userDir)) {
      await fs.remove(userDir);
      console.log(
        `User image folder for user ID ${userId} deleted successfully.`
      );
    } else {
      console.log(`No image folder found for user ID ${userId}.`);
    }
  } catch (error) {
    console.error(`Error deleting image folder for user ID ${userId}:`, error);
    throw error;
  }
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

module.exports = {
  register,
  getUser,
  login,
  getFriendsList,
  register_steps_user_data,
  user_terms_agree,
  register_user_portfolio_data,
  update_register_user_portfolio_data,
  getUserData,
  verifyToken,
  getAllUsersToHomepage,
  getUserFriendsPendinglistData,
  getUserFriendslistData,
  getHartingList,
  update_user_nic_images,
  getAllUsers,
  updateProfilePic,
  getMessagessList,
  deleteUserData,
};
