// pusherService.js
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
    handleUserOnline(userId); // Handle saved events when user subscribes
};

const subscribeToChannelremove = (userId) => {
    onlineUsers.delete(userId); // Track the user as online
};

// Save event if the user is offline
const saveEvent = async (friendId, data) => {
    await db.query('INSERT INTO saved_events (friend_id, event_name, event_data) VALUES (?, ?, ?)', [friendId, 'harting-added', JSON.stringify(data)]);
  };
  
  // Send notification or save event based on user status
  const sendHartingNotification = async (friendId, data) => {
    try {
      // Check if the user is online
      const isOnline = onlineUsers.has(friendId);
  
      if (isOnline) {
        console.log(`Sending notification to private-harting-${friendId}`);
        await pusher.trigger(`private-harting-${friendId}`, "harting-added", data);
        console.log("Notification sent successfully");
      } else {
        console.log(`User ${friendId} is offline. Saving event.`);
        await saveEvent(friendId, data);
        console.log("Event saved successfully");
      }
    } catch (error) {
      console.error("Error processing notification:", error);
    }
  };
  
  
  // Function to handle user coming online and send saved events
  const handleUserOnline = (friendId) => {
    // Retrieve saved events for the user
    db.query('SELECT * FROM saved_events WHERE friend_id = ?', [friendId], async (err, results) => {
      if (err) {
        console.error("Error retrieving saved events:", err);
        return;
      }
  
      // Process each saved event
      for (const event of results) {
        try {
          const eventData = JSON.parse(event.event_data);
  
          // Send the notification
          await sendHartingNotification(friendId, eventData);
  
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
  pusher, // Export the pusher instance as well
  subscribeToChannel,
  subscribeToChannelremove
};
