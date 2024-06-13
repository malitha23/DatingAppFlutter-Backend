// socketService.js

module.exports = function (io, db, users) {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("joinRoom", ({ userId, friendId }) => {
      try {
        let isFriend = true;
        let isRequestApprove = true;

        const checkSql =
          "SELECT * FROM `friendships` WHERE `user_id` = ? AND `friend_id` = ? AND `status` = 'pending'";
        db.query(checkSql, [userId, friendId], (err, results) => {
          if (err) {
            handleError(err, socket);
            return;
          }

          if (results.length > 0) {
            isFriend = false;
          }
        });
        const checkSqll =
          "SELECT * FROM `friendships` WHERE `user_id` = ? AND `friend_id` = ? AND `status` = 'pending'";
        db.query(checkSqll, [friendId, userId], (err, results) => {
          if (err) {
            handleError(err, socket);
            return;
          }

          if (results.length > 0) {
            isRequestApprove = false;
          }
        });

        const roomName = [userId, friendId].sort().join("_");
        socket.join(roomName);
        console.log(`User ${userId} joined room ${roomName}`);

        // Fetch message history
        const sql =
          "SELECT messageId, message, sender_id, receiverId, status, created_at FROM messages WHERE room_name = ? ORDER BY created_at DESC LIMIT 50";
        db.query(sql, [roomName], (err, results) => {
          if (err) {
            handleError(err);
            return;
          }
          socket.emit("roomHistory", {
            room: roomName,
            messages: results,
            isFriend: isFriend,
            isRequestApprove: isRequestApprove,
          });
        });
      } catch (error) {
        handleError(error);
      }
    });

    socket.on("getCoinBalance", (data) => {
      const userId = data.userId;
      db.query(
        "SELECT coin_balance FROM coin_balance WHERE userId = ?",
        [userId],
        (err, results) => {
          if (err) throw err;
          if (results.length > 0) {
            socket.emit("coinBalance", { balance: results[0].coin_balance });
          }
        }
      );
    });

    socket.on("updateCoinBalance", (data) => {
      const { userId, newBalance } = data;
      db.query(
        "UPDATE coin_balance SET coin_balance = ? WHERE userId = ?",
        [newBalance, userId],
        (err, results) => {
          if (err) throw err;
          console.log("Coin balance updated for user", userId);
        }
      );
    });

    socket.on(
      "privateMessage",
      ({ id, room, message, senderId, receiverId, status, created_at }) => {
        try {
          console.log(`Received message: ${created_at}`);
          if (typeof message !== "string") {
            console.error("Invalid message type received");
            return;
          }

          const sql =
            "INSERT INTO messages (messageId, room_name, sender_id, receiverId, message, status) VALUES (?, ?, ?, ?, ?, ?)";
          db.query(
            sql,
            [id, room, senderId, receiverId, message, status],
            (err, result) => {
              if (err) {
                handleError(err);
                return;
              }
              console.log("Message saved to database");

              io.to(room).emit("privateMessage", {
                id,
                room,
                message,
                senderId,
                receiverId,
                status,
                created_at,
              });

              // Check if the receiver is connected
              if (users[receiverId]) {
                const deliveryStatus = "delivered";
                io.to(users[receiverId]).emit("privateMessage", {
                  id,
                  room,
                  message,
                  senderId,
                  receiverId,
                  status,
                  created_at,
                });
                io.to(users[receiverId]).emit("messageDelivered", {
                  id,
                  deliveryStatus,
                });
                io.to(users[senderId]).emit("messageDelivered", {
                  id,
                  deliveryStatus,
                });
                // Uncomment to update the database with delivery status
                const updateSql =
                  "UPDATE messages SET status = ? WHERE messageId = ?";
                db.query(updateSql, [deliveryStatus, id], (err, result) => {
                  if (err) handleError(err);
                });

                try {
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
                    [receiverId, receiverId, receiverId],
                    async (err, friendsResults) => {
                      if (err) {
                        console.error(err);
                        return res
                          .status(500)
                          .json({ error: "Internal server error" });
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
                            [receiverId, friend.id, friend.id, receiverId],
                            (err, messageResult) => {
                              if (err) {
                                console.error(err);
                                reject(err);
                              } else {
                                resolve({
                                  friend,
                                  lastMessage: messageResult[0],
                                });
                              }
                            }
                          );
                        });

                        // Push the promise into the array
                        lastMessagesPromises.push(promise);
                      }

                      // Wait for all promises to resolve
                      const lastMessagesResults = await Promise.all(
                        lastMessagesPromises
                      );

                      io.to(users[receiverId]).emit("getlastmessagesReturn", {
                        lastMessagesResults,
                      });
                    }
                  );
                } catch (error) {
                  handleError(error);
                }
              }
            }
          );
        } catch (error) {
          handleError(error);
        }
      }
    );

    // Listen for socket event to delete messages
    socket.on("deleteMessages", (data) => {
      const { userId, friendId, selectedMessageIds } = data;
      // console.log('Messages deleted successfully:', selectedMessageIds);
      // Construct SQL query to delete messages with the provided message IDs
      const deleteSql = "DELETE FROM messages WHERE messageId IN (?)";
      db.query(deleteSql, [selectedMessageIds], (err, result) => {
        if (err) {
          handleError(err);
          // Handle error response to client
        } else {
          // console.log('Messages deleted successfully:', result);
          io.to(users[friendId]).emit("messagesDeleted", selectedMessageIds);
          io.to(users[userId]).emit("messagesDeleted", selectedMessageIds);
          try {
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
              [friendId, friendId, friendId],
              async (err, friendsResults) => {
                if (err) {
                  console.error(err);
                  return res
                    .status(500)
                    .json({ error: "Internal server error" });
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
                      [friendId, friend.id, friend.id, friendId],
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

                // Wait for all promises to resolve
                const lastMessagesResults = await Promise.all(
                  lastMessagesPromises
                );
                io.to(users[friendId]).emit("getlastmessagesReturn", {
                  lastMessagesResults,
                });
              }
            );
          } catch (error) {
            handleError(error);
          }
        }
      });
    });

    socket.on("markMessageAsSeen", (data) => {
      try {
        const { messageId, userId, friendId, room } = data;

        markMessageAsSeen(messageId, userId, (err) => {
          if (err) {
            handleError(err);
            return;
          }
          socket.to(room).emit("messageSeen", { messageId, seenBy: userId });
          socket
            .to(users[friendId])
            .emit("messageSeenPub", { messageId, seenBy: userId });
        });
      } catch (error) {
        handleError(error);
      }
    });

    socket.on("typing", ({ room, userId, friendId, isTyping }) => {
      try {
        socket
          .to(users[friendId])
          .emit("onlineTyping", { userId, friendId, isTyping });
        socket.to(room).emit("typing", { userId, isTyping });
      } catch (error) {
        handleError(error);
      }
    });

    socket.on("onlineStatus", ({ userId, isOnline }) => {
      try {
        users[userId] = socket.id;
        console.log(`User ${userId} is ${isOnline ? "online" : "offline"}`);
        io.emit("onlineStatus", { userId, isOnline });

        // Update user's online status in the database
        updateUserOnlineStatus(userId, isOnline);
        updateUserDeliveredStatusFormessages(userId);

        // Send unseen messages count when user comes online
        if (isOnline) {
          sendUnseenMessagesCount(userId);
        }

        if (!isOnline) {
          try {
            if (users[userId] === socket.id) {
              delete users[userId];
              console.log(`User ${userId} disconnected`);
            }
          } catch (error) {
            handleError(error);
          }
        }
      } catch (error) {
        handleError(error);
      }
    });

    socket.on("sendDeliveredStatusauto", ({ messageId, status }) => {
      const id = messageId;
      try {
        const deliveryStatus = "delivered";
        io.emit("messageDelivered", { id, deliveryStatus });

        // Uncomment to update the database with delivery status
        const updateSql = "UPDATE messages SET status = ? WHERE messageId = ?";
        db.query(updateSql, [deliveryStatus, messageId], (err, result) => {
          if (err) handleError(err);
        });
      } catch (error) {
        handleError(error);
      }
    });

    socket.on("getlastmessages", ({ userId }) => {
      const id = userId;

      try {
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
        db.query(friendsSql, [id, id, id], async (err, friendsResults) => {
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
                [id, friend.id, friend.id, id],
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

          // Wait for all promises to resolve
          const lastMessagesResults = await Promise.all(lastMessagesPromises);
          io.to(users[userId]).emit("getlastmessagesReturn", {
            lastMessagesResults,
          });
          io.to(users[userId]).emit("unseenMessagesCount", 0);
        });
      } catch (error) {
        handleError(error);
      }
    });

    socket.on("addFriend", async ({ userId, friendId, isFriend }) => {
      console.log(
        `Processing friendship for user ${userId} and friend ${friendId}, isFriend: ${isFriend}`
      );
      try {
        const friendsSql =
          "SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?";

        // Execute the SQL query to check for existing friendship record
        db.query(
          friendsSql,
          [userId, friendId],
          async (err, friendsResults) => {
            if (err) {
              console.error("Database error:", err);
              socket.emit("error", { message: "Internal server error" });
              return;
            }

            let query;
            let params;
            if (friendsResults.length > 0) {
              // Friendship record already exists, update its status
              query =
                "UPDATE friendships SET status = ?, updated_at = ? WHERE user_id = ? AND friend_id = ?";
              params = [
                isFriend ? "pending" : "unfriend",
                new Date(),
                userId,
                friendId,
              ];
            } else {
              // Friendship record doesn't exist, insert a new record
              query =
                "INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)";
              params = [
                userId,
                friendId,
                isFriend ? "pending" : "unfriend",
                new Date(),
                new Date(),
              ];
            }

            db.query(query, params, (err, result) => {
              if (err) {
                console.error("Database error:", err);
                socket.emit("error", { message: "Internal server error" });
                return;
              }

              const friendsSql =
                "SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?";
              db.query(
                friendsSql,
                [friendId, userId],
                async (err, friendsResultscheck2) => {
                  if (friendsResultscheck2.length > 0) {
                    if (!isFriend) {
                      // isFriend is false, delete the records
                      const deleteSql =
                        "DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)";
                      const deleteParams = [userId, friendId, friendId, userId];

                      db.query(deleteSql, deleteParams, (err, result) => {
                        if (err) {
                          console.error("Database error:", err);
                          socket.emit("error", {
                            message: "Internal server error",
                          });
                          return;
                        }
                        io.to(users[userId]).emit("friendsRequestResponse", { id:0, userId, friendId, status:'Reject'});
                        io.to(users[friendId]).emit("friendsRequestResponse", { id:0, userId, friendId, status:'Reject'});

                        console.log(
                          `Friendship records deleted successfully for user ${userId} and friend ${friendId}`
                        );
                        // Emit an update back to the client if needed
                      });
                    } else {
                      // isFriend is true, update the records
                      const updateSql =
                        "UPDATE friendships SET status = ?, updated_at = ? WHERE user_id = ? AND friend_id = ?";
                      const updateParams = [
                        "friend",
                        new Date(),
                        userId,
                        friendId,
                      ];

                      db.query(updateSql, updateParams, (err, result) => {
                        if (err) {
                          console.error("Database error:", err);
                          socket.emit("error", {
                            message: "Internal server error",
                          });
                          return;
                        }

                        const updateSql2 =
                          "UPDATE friendships SET status = ?, updated_at = ? WHERE user_id = ? AND friend_id = ?";
                        const updateParams2 = [
                          "friend",
                          new Date(),
                          friendId,
                          userId,
                        ];

                        db.query(updateSql2, updateParams2, (err, result) => {
                          if (err) {
                            console.error("Database error:", err);
                            socket.emit("error", {
                              message: "Internal server error",
                            });
                            return;
                          }
                          io.to(users[userId]).emit("friendsRequestResponse", { id:0, userId, friendId, status:'Accept'});
                          io.to(users[friendId]).emit("friendsRequestResponse", { id:0, userId, friendId, status:'Accept'});
                          console.log(
                            `Friendship records updated successfully for user ${userId} and friend ${friendId}`
                          );
                          // Emit an update back to the client if needed
                        });
                      });
                    }
                  }
                }
              );

              let recordId;
              let createdAt = new Date();
              let updatedAt = new Date();

              if (friendsResults.length > 0) {
                recordId = friendsResults[0].id;
                createdAt = friendsResults[0].created_at;
                updatedAt = new Date(); // Updated at current time
              } else {
                recordId = result.insertId;
              }

              if (result.affectedRows > 0 || result.insertId) {
                console.log(
                  `Friendship record processed successfully for user ${userId}`
                );

                // Fetch additional user data
                const userSql = `
                    SELECT 
r.firstName AS friendrequestAddedfname,
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
                      LEFT JOIN 
                      register_user_portfolio_data r ON friends.user_id = r.userId
                    WHERE 
                      u.id= ?
                  `;
                db.query(userSql, [userId], (err, userResults) => {
                  if (err) {
                    console.error("Database error:", err);
                    socket.emit("error", { message: "Internal server error" });
                    return;
                  }

                  if (userResults.length > 0) {
                    const userData = userResults[0];
                    // Structure the emitted data in the required format
                    const emittedData = {
                      online: userData.online,
                      friendrequestAddedfname:userData.friendrequestAddedfname,
                      profilePic: userData.profilePic,
                      firstName: userData.firstName,
                      lastName: userData.lastName,
                      id: recordId,
                      user_id: userId,
                      friend_id: friendId,
                      status: isFriend ? "pending" : "unfriend",
                      created_at: createdAt,
                      updated_at: updatedAt,
                    };

                    io.to(users[friendId]).emit(
                      "friendshipStatusChanged",
                      emittedData
                    );
                    io.to(users[userId]).emit(
                      "friendshipStatusChanged",
                      emittedData
                    );
                  } else {
                    console.error(
                      `Failed to fetch user data for user ${userId}`
                    );
                    socket.emit("error", {
                      message: "Failed to fetch user data",
                    });
                  }
                });
              } else {
                console.error(
                  `Failed to process friendship record for user ${userId}`
                );
                socket.emit("error", {
                  message: "Failed to process friendship record",
                });
              }
            });
          }
        );
      } catch (error) {
        console.error("Error adding/updating friendship record:", error);
        socket.emit("error", { message: "Internal server error" });
      }
    });

    // Assuming you have a Socket.io server set up in your Node.js app

    socket.on("addHarting", async (data) => {
      try {
        // Extract data from the incoming socket event
        const { userId, friendId, isHarting } = data;

        // Check if the combination of user_id and friend_id exists
        const checkQueryString = `
                SELECT * FROM user_harting 
                WHERE user_id = ? AND friend_id = ?
            `;

        // Execute the query to check for the existence of the combination
        db.query(checkQueryString, [userId, friendId], async (err, result) => {
          if (err) {
            console.error("Database error:", err);
            socket.emit("error", { message: "Internal server error" });
            return;
          }

          // Check the count result
          if (result.length <= 0) {
            // If the count is 0, perform an INSERT
            const insertQueryString = `
                    INSERT INTO user_harting (user_id, friend_id, is_harting) 
                    VALUES (?, ?, ?)
                `;
            await db.query(insertQueryString, [userId, friendId, isHarting]);
          } else {
            // If the count is 1, perform an UPDATE
            const updateQueryString = `
                    UPDATE user_harting 
                    SET is_harting = ?
                    WHERE user_id = ? AND friend_id = ?
                `;
            await db.query(updateQueryString, [isHarting, userId, friendId]);
          }
        });

        const getLikedUserData = `SELECT DISTINCT
       r.firstName AS hartAddedfname, r.lastName AS hartAddedLname,
        users.nic, users.online, register_user_portfolio_data.firstName, register_user_portfolio_data.lastName, register_steps_user_data.profilePic, register_steps_user_data.age, register_steps_user_data.gender,  hart.id AS hartingId, hart.user_id AS hartAddedId, hart.friend_id, hart.is_harting, hart.created_at
         FROM users 
         JOIN user_harting hart ON users.id = hart.friend_id
         JOIN register_user_portfolio_data ON users.id = register_user_portfolio_data.userId 
         JOIN register_user_portfolio_data r ON hart.user_id = r.userId 
         JOIN register_steps_user_data ON users.id = register_steps_user_data.userId 
         WHERE users.id = ?`;

        db.query(getLikedUserData, [friendId], async (err, result) => {
          if (err) {
            console.error("Database error:", err);
            return;
          }
          // Iterate over the result array
          for (let i = 0; i < result.length; i++) {
            const row = result[i];

            // Access specific column data from the row
            const nic = row.nic;
            const online = row.online;
            const firstName = row.firstName;
            const lastName = row.lastName;
            const profilePic = row.profilePic;
            const age = row.age;
            const gender = row.gender;
            const hartingId = row.hartingId;
            const friendId = row.friend_id;
            // const isHarting = row.is_harting;
            const createdAt = row.created_at;

            // // Log the specific column data
            // console.log("NIC:", nic);
            // console.log("Online:", online);
            // console.log("First Name:", firstName);
            // console.log("Last Name:", lastName);
            // console.log("Profile Pic:", profilePic);
            // console.log("Age:", age);
            // console.log("Gender:", gender);
            // console.log("Harting ID:", hartingId);
            // console.log("Friend ID:", friendId);
            // console.log("Is Harting:", isHarting);
            // console.log("Created At:", createdAt);
            io.to(users[userId]).emit("hartingadded", {
              nic,
              online,
              firstName,
              lastName,
              profilePic,
              age,
              gender,
              hartingId,
              friendId,
              isHarting,
              createdAt,
            });
          }
        });
        io.to(users[friendId]).emit("hartingadded", {
          userId,
          friendId,
          isHarting,
        });
        // Emit an acknowledgment back to the client if needed
        // socket.emit('hartingAdded', { success: true });
      } catch (error) {
        // Handle errors by logging them
        console.error("Error handling harting:", error);
        // Optionally, send an error acknowledgment back to the client
        // socket.emit('hartingAdded', { success: false, error: error.message });
      }
    });

    // Listen for the 'friendsRequestAcceptOrReject' event
    socket.on("friendsRequestAcceptOrReject", (data) => {
      const { id, userId, friendId, status } = data;
      try {
        if (status === "Reject") {
          const deleteSql = "DELETE FROM `friendships` WHERE `id` = ?";
          db.query(deleteSql, [id], (err, result) => {
            if (err) {
              handleError(err, socket);
              // Handle error response to client
            } else {
              console.log(
                `Friend request with ID ${id} rejected and deleted successfully`
              );
              io.to(users[userId]).emit("friendsRequestResponse", data);
              io.to(users[friendId]).emit("friendsRequestResponse", data);
            }
          });
        } else if (status === "Accept") {
          const updateSql =
            "UPDATE `friendships` SET `status`=?, `updated_at`=? WHERE `id`=?";
          const updatedAt = new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");
          db.query(updateSql, ["friend", updatedAt, id], (error, results) => {
            if (error) {
              handleError(error, socket);
            } else {
              const insertSql =
                "INSERT INTO `friendships`(`user_id`, `friend_id`, `status`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, ?)";
              const createdAt = new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ");
              db.query(
                insertSql,
                [friendId, userId, "friend", createdAt, createdAt],
                (insertError) => {
                  if (insertError) {
                    handleError(insertError, socket);
                  } else {
                    console.log(
                      `Friend request with ID ${id} accepted successfully`
                    );
                    io.to(users[userId]).emit("friendsRequestResponse", data);
                    io.to(users[friendId]).emit("friendsRequestResponse", data);
                  }
                }
              );
            }
          });
        }
      } catch (error) {
        handleError(error, socket);
      }
    });
    
    socket.on("Unfriendfriends", (data) => {
      const { id, userId, friendId, status } = data;
      try {
        if (status === "Reject") {
          const deleteSql = "DELETE FROM `friendships` WHERE (`user_id` = ? AND `friend_id` = ?) OR (`user_id` = ? AND `friend_id` = ?)";
          db.query(deleteSql, [userId, friendId, friendId, userId], (err, result) => {
            if (err) {
              handleError(err, socket);
              // Handle error response to client
            } else {
              console.log(
                `Friend request with ID ${id} rejected and deleted successfully`
              );
              io.to(users[userId]).emit("friendsRequestResponse", data);
              io.to(users[friendId]).emit("friendsRequestResponse", data);
            }
          });
        }
      } catch (error) {
        handleError(error, socket);
      }
    });

    socket.on("disconnect", () => {
      try {
        for (const userId in users) {
          if (users[userId] === socket.id) {
            delete users[userId];
            console.log(`User ${userId} disconnected`);
            io.emit("onlineStatus", { userId, isOnline: false });

            // Update user's online status in the database
            updateUserOnlineStatus(userId, false);
            break;
          }
        }
      } catch (error) {
        handleError(error);
      }
    });
  });

  function markMessageAsSeen(messageId, userId, cb) {
    try {
      const sql = "UPDATE messages SET status = ? WHERE messageId = ?";
      db.query(sql, ["seen", messageId], (err, result) => {
        if (err) {
          console.error("Error updating message seen status:", err);
          return cb(err);
        }
        console.log(`Message ${messageId} marked as seen by user ${userId}`);
        cb(null);
      });
    } catch (error) {
      handleError(error);
      cb(error);
    }
  }

  // Update user online status in the database
  function updateUserOnlineStatus(userId, isOnline) {
    try {
      db.query(
        "UPDATE users SET online = ? WHERE id = ?",
        [isOnline ? 1 : 0, userId],
        (error, results) => {
          if (error) {
            console.error("Error updating user online status:", error);
            return;
          }
          console.log("User online status updated successfully");
        }
      );
    } catch (error) {
      handleError(error);
    }
  }

  function updateUserDeliveredStatusFormessages(userId) {
    const deliveryStatus = "delivered";
    const selectQuery =
      "SELECT id, messageId, room_name, sender_id, receiverId, message, status, created_at FROM messages WHERE receiverId = ? AND status = ?";
    const updateQuery = "UPDATE messages SET status = ? WHERE id = ?";

    try {
      db.query(selectQuery, [userId, "sent"], (error, results) => {
        if (error) {
          console.error("Error fetching messages:", error);
          return;
        }

        results.forEach((message) => {
          const { id, messageId, sender_id } = message;

          // Update the status of the message to 'delivered'
          db.query(updateQuery, [deliveryStatus, id], (updateError) => {
            if (updateError) {
              console.error("Error updating message status:", updateError);
              return;
            }
            // Notify the sender about the delivery status
            if (users[sender_id]) {
              io.to(users[sender_id]).emit("messageDelivered", {
                id: messageId,
                deliveryStatus,
              });
            }
          });
        });
      });
    } catch (error) {
      handleError(error);
    }
  }

  function sendUnseenMessagesCount(userId) {
    try {
      if (!users[userId]) {
        console.error(`User ${userId} is not connected.`);
        return;
      }

      const sql =
        "SELECT COUNT(*) AS count FROM `messages` WHERE `receiverId` = ? AND `status` != ?";
      db.query(sql, [userId, "seen"], (err, results) => {
        if (err) {
          handleError(err);
          return;
        }
        if (!results || results.length === 0) {
          console.error(
            "No result or empty result set returned from the query."
          );
          return;
        }
        const count = results[0].count;
        console.log(count);
        io.to(users[userId]).emit("unseenMessagesCount", count);
      });
    } catch (error) {
      console.error("Error fetching unseen messages count:", error);
    }
  }
  // Utility function for error logging
  function handleError(error) {
    console.error("An error occurred:", error);
  }
};
