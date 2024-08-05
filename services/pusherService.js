// pusherService.js

const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "1845032",
  key: "ef98ed4e5e800bd01bc6",
  secret: "d61185c9cf0db47617ad",
  cluster: "ap2",
  useTLS: true, // Make sure this matches your Flutter configuration
});

const sendHartingNotification = async (friendId, data) => {
  try {
    console.log(`Sending notification to private-harting-${friendId}`);
    await pusher.trigger(`private-harting-${friendId}`, "harting-added", data);
   // await pusher.trigger("my-channel", "my-event", { message: "hello world" });
    console.log("Notification sent successfully");
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};

module.exports = {
  sendHartingNotification,
  pusher, // Export the pusher instance as well
};
