const database = require("../config/db");
const Pusher = require("pusher");
const db = database.connection;
const pusher = new Pusher({
  appId: "1845032",
  key: "ef98ed4e5e800bd01bc6",
  secret: "d61185c9cf0db47617ad",
  cluster: "ap2",
  useTLS: true, // Make sure this matches your Flutter configuration
});

const onlineUsers = new Set(); // Use a Set to track online users

const subscribeToChannel = (userId) => {
  onlineUsers.add(userId); // Track the user as online
  // Delay the execution of handleUserOnline by 4 seconds (4000 milliseconds)
  setTimeout(() => {
    handleUserOnline(userId); // Handle saved events when user subscribes
  }, 4000);
};


const subscribeToChannelremove = (userId) => {
    onlineUsers.delete(String(userId)); // Track the user as offline
};

const saveEvent = async (friendId, eventName, data) => {
  // Convert data to JSON string
  const eventData = JSON.stringify(data);

  // Check if the record already exists
  db.query('SELECT * FROM saved_events WHERE friend_id = ? AND event_name = ?', [friendId, eventName], async (err, results) => {
    if (err) {
      console.error('Error checking for existing event:', err);
      return;
    }

    // If the record exists, update it; otherwise, insert a new one
    if (results.length > 0) {
      // Update existing record
      const updateQuery = 'UPDATE saved_events SET event_data = ? WHERE friend_id = ? AND event_name = ?';
      db.query(updateQuery, [eventData, friendId, eventName], (updateErr) => {
        if (updateErr) {
          console.error('Error updating event:', updateErr);
        } else {
          console.log('Event updated successfully');
        }
      });
    } else {
      // Insert new record
      const insertQuery = 'INSERT INTO saved_events (friend_id, event_name, event_data) VALUES (?, ?, ?)';
      db.query(insertQuery, [friendId, eventName, eventData], (insertErr) => {
        if (insertErr) {
          console.error('Error inserting event:', insertErr);
        } else {
          console.log('Event inserted successfully');
        }
      });
    }
  });
};

const sendHartingNotification = async (friendId, data) => {
  await sendNotification(friendId, 'harting-added', data);
};

const sendMessageNotification = async (friendId, data) => {
  await sendNotification(friendId, 'message-received', data);
};

const sendNotification = async (friendId, eventName, data) => {
  try {
    const isOnline = onlineUsers.has(String(friendId));

    if (isOnline) {
      console.log(`Sending notification to private-${eventName}-${friendId}`);
      await pusher.trigger(`private-${eventName}-${friendId}`, eventName, data);
      console.log("Notification sent successfully");
    } else {
      console.log(`User ${friendId} is offline. Saving event.`);
      await saveEvent(friendId, eventName, data);
      console.log("Event saved successfully");
    }
  } catch (error) {
    console.error("Error processing notification:", error);
  }
};

const handleUserOnline = (friendId) => {
  db.query('SELECT * FROM saved_events WHERE friend_id = ?', [friendId], async (err, results) => {
    if (err) {
      console.error("Error retrieving saved events:", err);
      return;
    }

    for (const event of results) {
      try {
        const eventData = JSON.parse(event.event_data);

        // Send the notification
        await sendNotification(friendId, event.event_name, eventData);

        // Remove the event from the database after sending
        await new Promise((resolve, reject) => {
          db.query('DELETE FROM saved_events WHERE id = ?', [event.id], (err, result) => {
            if (err) {
              console.error("Error deleting saved event:", err);
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
      } catch (error) {
        console.error("Error processing event:", error);
      }
    }

    console.log('User is online and saved events are sent');
  });
};

module.exports = {
  sendHartingNotification,
  sendMessageNotification,
  pusher, // Export the pusher instance as well
  subscribeToChannel,
  subscribeToChannelremove
};
