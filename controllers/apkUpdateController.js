const database = require("../config/db");
const fetch = require("node-fetch"); // To send OTP via Notify.lk
const bcrypt = require('bcrypt');
const { verifyToken, getUserData } = require("./UserController");

const db = database.connection;

const fs = require('fs');
const path = require('path');

// Directory where APK files are stored
const apkDir = path.join(__dirname, '../uploadsUpdateApks/');


// Function to get the latest APK file
function getLatestApk() {
  const files = fs.readdirSync(apkDir);
  const apkFiles = files.filter(file => file.endsWith('.apk'));
  
  // Sort files by version number
  apkFiles.sort((a, b) => {
    const versionA = a.match(/(\d+\.\d+\.\d+)/)[0];
    const versionB = b.match(/(\d+\.\d+\.\d+)/)[0];
    return versionA.localeCompare(versionB, undefined, { numeric: true });
  });

  // Return the latest APK file name and version
  const latestApk = apkFiles[apkFiles.length - 1];
  const latestVersion = latestApk.match(/(\d+\.\d+\.\d+)/)[0];

  return {
    filename: latestApk,
    version: latestVersion,
  };
}

// Controller function for handling the version check request
const versionCheck = (req, res) => {
  const latestApk = getLatestApk();
  res.json({
    version: latestApk.version, // Dynamically set to the latest version
    update_message: "A new version of the app is available. Please update to the latest version for the best experience.",
    force_update: false, // Set to true if you want to force the update
    download_url: `/apk/${latestApk.filename}` // Serve the latest APK file
  });
};


module.exports = {
  versionCheck
};
