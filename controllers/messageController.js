const {
  client,
  getQrCode,
  isClientReady,
  isClientAuthenticated,
} = require("../services/whatsappClient"); // Adjust path if necessary

const database = require("../config/db");
const db = database.connection;

const sendMessage = async (req, res) => {
  const { userId, message, phoneNumber } = req.body;

  // Validate required fields
  if (!message || !phoneNumber) {
    return res.status(400).json({ message: "Message and phone number are required" });
  }

  // Format the phone number
  const formattedPhoneNumber = `${phoneNumber}@c.us`;

  // Ensure client is ready
  if (!isClientReady()) {
    const insertSql = `
      INSERT INTO sent_messages (user_id, whatsapp_number, message_content, reason)
      VALUES (?, ?, ?, ?)`;
    
          await db.query(insertSql, [
            userId,
            formattedPhoneNumber,
            message,
            "noReadyClient", // or another relevant reason
          ]);
    return res.status(500).json({ message: "WhatsApp client is not ready" });
  }

  try {
    // Get the registered WhatsApp ID for the number
    const numberDetails = await client.getNumberId(formattedPhoneNumber);
    
    if (!numberDetails) {
      const insertSql = `
      INSERT INTO sent_messages (user_id, whatsapp_number, message_content, reason)
      VALUES (?, ?, ?, ?)`;
    
          await db.query(insertSql, [
            userId,
            formattedPhoneNumber,
            message,
            "noWhatsAppaccount", // or another relevant reason
          ]);
      return res.status(400).json({ message: "This number is not registered on WhatsApp" });
    }

    // Send the message
    await client.sendMessage(formattedPhoneNumber, message);
    return res.status(200).json({ message: "WhatsApp message sent successfully" });
    
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    const insertSql = `
    INSERT INTO sent_messages (user_id, whatsapp_number, message_content, reason)
    VALUES (?, ?, ?, ?)`;
  
        await db.query(insertSql, [
          userId,
          formattedPhoneNumber,
          message,
          "otherError", // or another relevant reason
        ]);
    return res.status(500).json({ message: "Failed to send WhatsApp message" });
  }
};

module.exports = {
  sendMessage,
};
