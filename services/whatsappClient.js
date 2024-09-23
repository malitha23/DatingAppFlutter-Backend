const { Client, LocalAuth } = require('whatsapp-web.js');
const database = require("../config/db");
const db = database.connection;

let qrCode = null;
let isReinitializing = false;
let isAuthenticated = false;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// Event listeners
client.on('qr', (qr) => {
  qrCode = qr;
  console.log('Whatsapp QR code received.');
});

client.on('authenticated', () => {
  isAuthenticated = true;
  console.log('Whatsapp Authenticated successfully.');
});

client.on('ready', () => {
  console.log('WhatsApp client is ready!');

  const selectSql = `
    SELECT whatsapp_number, message_content FROM sent_messages 
    WHERE reason != 'noWhatsAppaccount'`;

  console.log('Executing SQL:', selectSql);

  db.query(selectSql, (err, results) => {
    if (err) {
      // Handle SQL query errors
      console.error('Error fetching messages from the database:', err);
      return;
    }

    console.log('Query results:', results);

    if (results.length > 0) {
      results.forEach(async (row) => {
        const whatsappNumber = row.whatsapp_number;

        // Send the message
        try {
          await client.sendMessage(`${whatsappNumber}`, row.message_content);
          console.log(`Message sent to ${whatsappNumber}`);

          // Delete the message entry from the database
          const deleteSql = `DELETE FROM sent_messages WHERE whatsapp_number = ? AND message_content = ?`;
          await db.query(deleteSql, [whatsappNumber, row.message_content]);
          console.log(`Message entry for ${whatsappNumber} deleted successfully.`);
        } catch (sendError) {
          console.error(`Error sending message to ${whatsappNumber}:`, sendError);
        }
      });
    } else {
      console.log('No messages to send.');
    }
  });
});



client.on('auth_failure', (msg) => {
  isAuthenticated = false;
  console.error('Authentication failed:', msg);
  handleClientReinitialization(); // Reset and reinitialize on failure
});

client.on('disconnected', async (reason) => {
  console.log('WhatsApp client was logged out:', reason);
  handleClientReinitialization(); // Reset and reinitialize on disconnection
});

client.initialize().catch((error) => {
  console.error('Error initializing WhatsApp client:', error);
});

// Function to get the QR code
const getQrCode = () => {
  return qrCode;
};

// Function to check if the client is ready
const isClientReady = () => {
  return isAuthenticated && client && client.info && client.info.wid;
};

// Function to check if the client is authenticated
const isClientAuthenticated = () => {
  return isAuthenticated;
};


// Function to handle client reinitialization
const handleClientReinitialization = async () => {
  if (!isReinitializing) {
    isReinitializing = true;
    try {
      await resetClient(); // Reset and reinitialize the client
      console.log('Whatsapp Client reinitialized successfully.');
    } catch (error) {
      console.error('Error during client reinitialization:', error);
    } finally {
      isReinitializing = false;
    }
  }
};

// Function to reset the client
const resetClient = async () => {
  qrCode = null; // Clear the existing QR code
  isAuthenticated = false; // Reset authentication state
  try {
    await client.destroy(); // Destroy the current instance
    console.log('Whatsapp Client destroyed. Reinitializing...');
    await client.initialize(); // Reinitialize the client
  } catch (error) {
    console.error('Error during resetClient:', error);
  }
};

// Export the client and functions
module.exports = {
  client,
  getQrCode,
  isClientReady,
  isClientAuthenticated,
  resetClient,
};
