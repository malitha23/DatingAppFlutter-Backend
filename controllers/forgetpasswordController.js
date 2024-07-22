const database = require("../config/db");
const fetch = require("node-fetch"); // To send OTP via Notify.lk
const bcrypt = require('bcrypt');
const { verifyToken, getUserData } = require("./UserController");

const db = database.connection;

const forgetpassword = async (req, res) => {
  try {
    const { nic, key } = req.body;

    // Check if at least one of `nic` or `key` is provided
    if (!nic && !key) {
      return res
        .status(400)
        .json({ message: "At least one of NIC or Key is required" });
    }

    // Determine the query based on the provided value
    let query, params;
    if (nic) {
      query = "SELECT * FROM `users` WHERE `nic` = ?";
      params = [nic];
    } else if (key) {
      query = "SELECT * FROM `users` WHERE `generatedKey` = ?";
      params = [key];
    }

    // Query the database to find the user
    db.query(query, params, async (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "Database query error", error: err });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = results[0];
      const userData = await getUserData(user.nic);
      if (!userData) {
        return res.status(404).json({ message: "User not found" });
      }
      const  whatsAppNumber  = userData.whatsAppNumber;


      // Check if `whatsAppNumber` exists and is of valid length
      if (!whatsAppNumber || whatsAppNumber.length !== 10) {
        return res
          .status(404)
          .json({ message: "User phone number not found or invalid" });
      }
      const otp = generateOTP();
      const expiration = Date.now() + 300000; // 5 minutes from now
       // Format the user's phone number
       const formattedPhoneNumber = formatPhoneNumber(whatsAppNumber);

      // Update user with OTP and expiration
      db.query(
        "UPDATE `users` SET `passwordResetCode` = ?, `passwordResetExpires` = ? WHERE `id` = ?",
        [otp, expiration, user.id],
        async (err) => {
          if (err) {
            return res
              .status(500)
              .json({ message: "Error updating OTP", error: err });
          }

          // Send OTP via Notify.lk
          const message = `Your OTP for password reset is ${otp}`;
          const notifyURL = `https://app.notify.lk/api/v1/send?user_id=${
            process.env.NOTIFY_LK_USER_ID
          }&api_key=${process.env.NOTIFY_LK_API_KEY}&sender_id=${
            process.env.NOTIFY_LK_SENDER_ID
          }&to=${formattedPhoneNumber}&message=${encodeURIComponent(
            message
          )}`;

          try {
            const response = await fetch(notifyURL);

            // Check if the response status is OK
            if (!response.ok) {
                const errorText = await response.text();
                return res.status(response.status).json({ message: 'Failed to send OTP', error: errorText });
            }

            // Optionally parse JSON response if needed
            const responseData = await response.json();

            // Handle the response data (e.g., log it or use it for additional checks)
            console.log('Notify.lk Response:', responseData);
            res.status(200).json({ message: "OTP sent successfully", pno:whatsAppNumber });
          } catch (fetchError) {
            res
              .status(500)
              .json({
                message: "Failed to send OTP",
                error: fetchError.message,
              });
          }
        }
      );
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { nic, key, otp } = req.body;

    // Validate request
    if ((!nic && !key) || !otp) {
      return res.status(400).json({ message: 'NIC or Key and OTP are required' });
    }

    // Determine the query based on the provided value
    let query, params;
    if (nic) {
      query = 'SELECT `passwordResetCode`, `passwordResetExpires` FROM `users` WHERE `nic` = ?';
      params = [nic];
    } else if (key) {
      query = 'SELECT `passwordResetCode`, `passwordResetExpires` FROM `users` WHERE `generatedKey` = ?';
      params = [key];
    }

    // Query the database to find the user and check OTP
    db.query(query, params, (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Database query error', error: err });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = results[0];
      const { passwordResetCode, passwordResetExpires } = user;

      // Check if OTP matches and is not expired
      if (passwordResetCode !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }

       // Check if OTP matches and is not expired
       if (Date.now() > passwordResetExpires) {
        return res.status(400).json({ message: 'OTP is Expired' });
      }

      // OTP is valid, proceed with password reset or other actions
      return res.status(200).json({ message: 'OTP verified successfully' });
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// change password and save it
const changepassword = async (req, res) => {
  try {
    const { nic, key, password } = req.body;

    // Validate request
    if ((!nic && !key) || !password) {
      return res.status(400).json({ message: 'NIC or Registerd Key, and Password are required' });
    }

    // Determine the query based on the provided value
    let query, params;
    if (nic) {
      query = 'SELECT `id`, `passwordResetCode`, `passwordResetExpires` FROM `users` WHERE `nic` = ?';
      params = [nic];
    } else if (key) {
      query = 'SELECT `id`, `passwordResetCode`, `passwordResetExpires` FROM `users` WHERE `generatedKey` = ?';
      params = [key];
    }

    // Query the database to find the user and check OTP
    db.query(query, params, async (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Database query error', error: err });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = results[0];
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the user's password in the database
      db.query(
        'UPDATE `users` SET `password` = ?, `passwordResetCode` = NULL, `passwordResetExpires` = NULL WHERE `id` = ?',
        [hashedPassword, user.id],
        (err) => {
          if (err) {
            return res.status(500).json({ message: 'Error updating password', error: err });
          }

          return res.status(200).json({ message: 'Password updated successfully' });
        }
      );
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

const formatPhoneNumber = (phoneNumber) => {
  // Remove any non-digit characters
  let cleaned = ('' + phoneNumber).replace(/\D/g, '');

  // Check if the number starts with '0' and remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Ensure the phone number is 10 digits long after removing the leading zero
  if (cleaned.length !== 9) {
    throw new Error('Invalid phone number length');
  }

  // Add international dialing code prefix (e.g., 94 for Sri Lanka)
  const formattedNumber = `94${cleaned}`;

  return formattedNumber;
};


module.exports = {
  forgetpassword,
  verifyOtp,
  changepassword
};
