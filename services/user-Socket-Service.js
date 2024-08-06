// socketService.js
const util = require("util");
const {
  sendHartingNotification,
  subscribeToChannel,
  subscribeToChannelremove,
  sendMessageNotification,
} = require("./pusherService.js");
module.exports = function (io, db, users) {
  const query = util.promisify(db.query).bind(db);

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

              // Define the SQL query
              const messagesSenderData = `
SELECT 
    rpd.profilePic, 
    rupd.firstName, 
    rupd.lastName 
FROM 
    register_steps_user_data rpd
INNER JOIN 
    register_user_portfolio_data rupd
ON 
    rpd.userId = rupd.userId
WHERE 
    rpd.userId = ?;
`;

              // Execute the query
              db.query(messagesSenderData, [senderId], async (err, results) => {
                if (err) throw err;

                // Process the results
                const notificationData = results.map((row) => ({
                  profilePic: row.profilePic,
                  firstName: row.firstName,
                  lastName: row.lastName,
                  room: room,
                  message: message,
                  created_at: created_at,
                  receiverId: receiverId,
                }));

                await sendMessageNotification(receiverId, notificationData);
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

                  // Execute the query to get the latest messages
                  db.query(
                    messagesSql,
                    [receiverId, receiverId, receiverId, receiverId],
                    async (err, messagesResults) => {
                      if (err) {
                        return res.status(500).json({ error: err.message });
                      }

                      // Collect user details promises
                      const userDetailsPromises = messagesResults
                        .filter(
                          (message) =>
                            message.receiverId != receiverId ||
                            message.sender_id != receiverId
                        )
                        .map((message) => {
                          const friendId =
                            message.receiverId != receiverId
                              ? message.receiverId
                              : message.sender_id;
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
                            db.query(
                              userSql,
                              [friendId],
                              (err, userResults) => {
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
                              }
                            );
                          });
                        });

                      try {
                        const lastMessagesResults = await Promise.all(
                          userDetailsPromises
                        );
                        io.to(users[receiverId]).emit("getlastmessagesReturn", {
                          lastMessagesResults,
                        });
                      } catch (userDetailsError) {
                        console.error(
                          "Error fetching user details:",
                          userDetailsError
                        );
                        // return res.status(500).json({ error: 'Internal server error' });
                      }
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

            // Execute the query to get the latest messages
            db.query(
              messagesSql,
              [friendId, friendId, friendId, friendId],
              async (err, messagesResults) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }

                // Collect user details promises
                const userDetailsPromises = messagesResults
                  .filter(
                    (message) =>
                      message.receiverId != friendId ||
                      message.sender_id != friendId
                  )
                  .map((message) => {
                    const friendIdIs =
                      message.receiverId != friendId
                        ? message.receiverId
                        : message.sender_id;
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
                      db.query(userSql, [friendIdIs], (err, userResults) => {
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
                  const lastMessagesResults = await Promise.all(
                    userDetailsPromises
                  );
                  io.to(users[friendId]).emit("getlastmessagesReturn", {
                    lastMessagesResults,
                  });
                } catch (userDetailsError) {
                  console.error(
                    "Error fetching user details:",
                    userDetailsError
                  );
                  // return res.status(500).json({ error: 'Internal server error' });
                }
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
          subscribeToChannel(userId);
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
      try {
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
              const lastMessagesResults = await Promise.all(
                userDetailsPromises
              );
              io.to(users[userId]).emit("getlastmessagesReturn", {
                lastMessagesResults,
              });
              io.to(users[userId]).emit("unseenMessagesCount", 0);
            } catch (userDetailsError) {
              console.error("Error fetching user details:", userDetailsError);
              // return res.status(500).json({ error: 'Internal server error' });
            }
          }
        );
      } catch (error) {
        handleError(error);
      }
    });

    socket.on("addFriendAutoForMessage", async ({ userId, friendId }) => {
      const friendsSql =
        "SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?";

      db.query(friendsSql, [userId, friendId], async (err, friendsResults) => {
        if (err) {
          console.error("Database error:", err);
          socket.emit("error", { message: "Internal server error" });
          return;
        }

        if (friendsResults.length > 0) {
          console.log("Friendship record already exists. No action taken.");
          return;
        }

        const query =
          "INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)";
        const params = [userId, friendId, "pending", new Date(), new Date()];

        db.query(query, params, (err, result) => {
          if (err) {
            console.error("Database error:", err);
            return;
          }
        });
      });
    });

    
    socket.on("addFriend", async ({ userId, friendId, isFriend, unfriend }) => {
      try {
        const queryFriendship =
          "SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?";
        const checkFriendship = (user1, user2) =>
          new Promise((resolve, reject) => {
            db.query(queryFriendship, [user1, user2], (err, results) => {
              if (err) reject(err);
              else resolve(results);
            });
          });

        const friendsResults = await checkFriendship(userId, friendId);
        const friendReverseResults = await checkFriendship(friendId, userId);

        let query, params;

        if (friendsResults.length > 0) {
          query =
            "UPDATE friendships SET status = ?, updated_at = ? WHERE user_id = ? AND friend_id = ?";
          params = [
            isFriend ? "pending" : "unfriend",
            new Date(),
            userId,
            friendId,
          ];
        } else {
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

        const executeQuery = (query, params) =>
          new Promise((resolve, reject) => {
            db.query(query, params, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });

        await executeQuery(query, params);

        if (friendReverseResults.length > 0) {
          if (!isFriend) {
            const deleteSql =
              "DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)";
            await executeQuery(deleteSql, [userId, friendId, friendId, userId]);

            const response = {
              id: 0,
              userId,
              friendId,
              status: "Reject",
              unfriend: unfriend ?? "",
            };
            if (users[userId]) {
              io.to(users[userId]).emit("friendsRequestResponse", response);
              console.log(`Emitted 'friendsRequestResponse' to user ${userId}`);
            }
            if (users[friendId]) {
              io.to(users[friendId]).emit("friendsRequestResponse", response);
              console.log(
                `Emitted 'friendsRequestResponse' to friend ${friendId}`
              );
            }
          } else {
            const updateSql =
              "UPDATE friendships SET status = ?, updated_at = ? WHERE user_id = ? AND friend_id = ?";
            await executeQuery(updateSql, [
              "friend",
              new Date(),
              userId,
              friendId,
            ]);
            await executeQuery(updateSql, [
              "friend",
              new Date(),
              friendId,
              userId,
            ]);

            const response = {
              id: 0,
              userId,
              friendId,
              status: "Accept",
              unfriend: unfriend ?? "",
            };
            if (users[userId]) {
              io.to(users[userId]).emit("friendsRequestResponse", response);
              console.log(`Emitted 'friendsRequestResponse' to user ${userId}`);
            }
            if (users[friendId]) {
              io.to(users[friendId]).emit("friendsRequestResponse", response);
              console.log(
                `Emitted 'friendsRequestResponse' to friend ${friendId}`
              );
            }
          }
        }

        const userSql = `
      SELECT 
        r.firstName AS friendrequestAddedfname,
        r.userId AS friendrequestAddedfId,
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
        u.id = ?
    `;

        db.query(userSql, [userId], (err, userResults) => {
          if (err) {
            console.error("Database error:", err);
            socket.emit("error", { message: "Internal server error" });
            return;
          }

          if (userResults.length > 0) {
            const userData = userResults[0];
            const emittedData = {
              online: userData.online,
              friendrequestAddedfname: userData.friendrequestAddedfname,
              friendrequestAddedfId: userData.friendrequestAddedfId,
              profilePic: userData.profilePic,
              firstName: userData.firstName,
              lastName: userData.lastName,
              id: userData.id,
              user_id: userId,
              friend_id: friendId,
              status: isFriend ? "pending" : "unfriend",
              created_at: userData.created_at,
              updated_at: userData.updated_at,
            };

            if (users[friendId]) {
              io.to(users[friendId]).emit(
                "friendshipStatusChanged",
                emittedData
              );
              console.log(
                `Emitted 'friendshipStatusChanged' to friend ${friendId}`
              );
            }
            if (users[userId]) {
              io.to(users[userId]).emit("friendshipStatusChanged", emittedData);
              console.log(
                `Emitted 'friendshipStatusChanged' to user ${userId}`
              );
            }
          } else {
            console.error(`Failed to fetch user data for user ${userId}`);
            socket.emit("error", { message: "Failed to fetch user data" });
          }
        });
      } catch (error) {
        console.error("Error adding/updating friendship record:", error);
        socket.emit("error", { message: "Internal server error" });
      }
    });

    socket.on("addHarting", async (data) => {
      try {
        const { userId, friendId, isHarting } = data;

        // Function to check if a user-harting relationship exists
        const checkIfExists = async (userId, friendId) => {
          const query = `SELECT * FROM user_harting WHERE user_id = ? AND friend_id = ?`;
          return new Promise((resolve, reject) => {
            db.query(query, [userId, friendId], (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        };

        // Function to insert a new user-harting relationship
        const insertHarting = async (userId, friendId, isHarting) => {
          const query = `INSERT INTO user_harting (user_id, friend_id, is_harting) VALUES (?, ?, ?)`;
          return new Promise((resolve, reject) => {
            db.query(query, [userId, friendId, isHarting], (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        };

        // Function to update an existing user-harting relationship
        const updateHarting = async (userId, friendId, isHarting) => {
          const query = `UPDATE user_harting SET is_harting = ? WHERE user_id = ? AND friend_id = ?`;
          return new Promise((resolve, reject) => {
            db.query(query, [isHarting, userId, friendId], (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        };

        // Function to get liked user data
        const getLikedUserData = async (friendId, userId) => {
          const query = `
            SELECT DISTINCT
              r.firstName AS hartAddedfname, 
              r.lastName AS hartAddedLname,
              users.nic, 
              users.online, 
              register_user_portfolio_data.firstName, 
              register_user_portfolio_data.lastName, 
              register_steps_user_data.profilePic, 
              register_steps_user_data.age, 
              register_steps_user_data.gender,  
              hart.id AS hartingId, 
              hart.user_id AS hartAddedId, 
              hart.friend_id, 
              hart.is_harting, 
              hart.created_at
            FROM users 
            JOIN user_harting hart ON users.id = hart.friend_id
            JOIN register_user_portfolio_data ON users.id = register_user_portfolio_data.userId 
            JOIN register_user_portfolio_data r ON hart.user_id = r.userId 
            JOIN register_steps_user_data ON users.id = register_steps_user_data.userId 
            WHERE users.id = ? AND hart.user_id = ? AND hart.friend_id = ?;
          `;
          return new Promise((resolve, reject) => {
            db.query(query, [friendId, userId, friendId], (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        };

        // Check if the combination of user_id and friend_id exists
        const existingHarting = await checkIfExists(userId, friendId);

        if (existingHarting.length <= 0) {
          // Perform an INSERT if the relationship does not exist
          await insertHarting(userId, friendId, isHarting);
        } else {
          // Perform an UPDATE if the relationship already exists
          await updateHarting(userId, friendId, isHarting);
        }

        // Get the liked user data
        const likedUserData = await getLikedUserData(friendId, userId);

        if (likedUserData.length > 0) {
          const row = likedUserData[0];
          const {
            nic,
            online,
            firstName,
            lastName,
            profilePic,
            age,
            gender,
            hartingId,
            friend_id: friendId,
            created_at: createdAt,
          } = row;
          const socketId = users[userId];
          if (socketId) {
            io.to(socketId).emit("hartingadded", {
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
            sendHartingNotification(friendId, { row });
            console.log(`Emitted to User socket ID: ${socketId}`);
          } else {
            console.error(`No socket found for userId: ${userId}`);
          }
        }
      } catch (error) {
        console.error("Error handling harting:", error);
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
      console.log(data);
      try {
        if (status === "Reject") {
          const deleteSql =
            "DELETE FROM `friendships` WHERE (`user_id` = ? AND `friend_id` = ?) OR (`user_id` = ? AND `friend_id` = ?)";
          db.query(
            deleteSql,
            [userId, friendId, friendId, userId],
            (err, result) => {
              if (err) {
                handleError(err, socket);
                // Handle error response to client
              } else {
                console.log(
                  `Friend request with ID ${id} rejected and deleted successfully`
                );
                io.to(users[userId]).emit("friendsRequestResponse", {
                  id,
                  userId,
                  friendId,
                  status,
                  unfriend: "unfriend",
                });
                io.to(users[friendId]).emit("friendsRequestResponse", {
                  id,
                  userId,
                  friendId,
                  status,
                  unfriend: "unfriend",
                });
              }
            }
          );
        }
      } catch (error) {
        handleError(error, socket);
      }
    });

    socket.on("logoutStatus", ({ userId, isLogout }) => {
      console.log("logout true");
      if (isLogout) {
        subscribeToChannelremove(userId);
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);

      // Optionally, you can clean up the user mapping on disconnect
      for (const userId in users) {
        if (users[userId] === socket.id) {
          console.log(`User ${userId} is offline`);
          io.emit("onlineStatus", { userId, isOnline: false });
          updateUserOnlineStatus(userId, false);
          delete users[userId];
          break;
        }
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
