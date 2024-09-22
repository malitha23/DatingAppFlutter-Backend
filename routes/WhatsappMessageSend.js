const router = require("express").Router();
const authController = require("../controllers/messageController");
const { getQrCode, isClientReady, resetClient, isClientAuthenticated } = require('../services/whatsappClient');

router.post('/send', authController.sendMessage);

// Endpoint to check WhatsApp connection status
router.get('/whatsapp-status', (req, res) => {
  const connected = isClientReady();
  const isAuthenticated = isClientAuthenticated();
  const status = {
    connected : connected ? true: false,
    isAuthenticated: isAuthenticated,
    qr: connected ? null : getQrCode(), // Return QR only if not connected
    message: connected ? 'Client is ready.' : 'Client is not ready.',
  };
  return res.json(status);
});

// Endpoint to sign out and reset the WhatsApp client
router.post('/signout', async (req, res) => {
  try {
    await resetClient(); // Reset the WhatsApp client
    return res.status(200).json({ message: 'Successfully signed out' });
  } catch (error) {
    console.error('Error during sign out:', error);
    return res.status(500).json({ message: 'Error signing out' });
  }
});

module.exports = router;
