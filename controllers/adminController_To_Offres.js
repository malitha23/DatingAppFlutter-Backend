const database = require("../config/db");
const bcrypt = require("bcrypt");
const moment = require("moment-timezone");
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");
const { verifyToken, getUserData } = require("./UserController");

const db = database.connection;

const getAllReferralOffersForAdmin = async (req, res) => {
  try {
    const sql = 'SELECT * FROM referral_code_offers';

    db.query(sql, (err, results) => {
      if (err) {
        console.error('Error fetching referral offers:', err);
        return res.status(500).json({ message: 'Error fetching referral offers' });
      }

      res.status(200).json(results);
    });
  } catch (error) {
    console.error('Error retrieving referral offers:', error);
    res.status(500).json({ message: "Error retrieving referral offers", error });
  }
};


const generateReferralCode = (referralName) => {
  const letters = referralName.split(' ').map(word => word[0]).join('');
  const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
  return (letters + randomString).substring(0, 10).toUpperCase();
};

const checkReferralCodeExists = (referralCode) => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT COUNT(*) AS count FROM referral_code_offers WHERE referral_code = ?';
    db.query(query, [referralCode], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0);
    });
  });
};

const insertReferralOffer = (offerValues) => {
  return new Promise((resolve, reject) => {
    const offerQuery = `
      INSERT INTO referral_code_offers (referral_code, referral_name, description, package_discount, add_hearts, start_date, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(offerQuery, offerValues, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

const AddNewReferralOffersForAdmin = async (req, res) => {
  const { referralName, description, packageDiscount, addHearts, startDate, expiryDate } = req.body;

  let referralCode;
  let codeExists;

  do {
    referralCode = generateReferralCode(referralName);
    try {
      codeExists = await checkReferralCodeExists(referralCode);
    } catch (err) {
      console.error('Error checking referral code:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }
  } while (codeExists);
  const packageDiscountParsed = JSON.parse(packageDiscount);
  const offerValues = [referralCode, referralName, description, JSON.stringify(packageDiscountParsed), addHearts, startDate, expiryDate];

  try {
    await insertReferralOffer(offerValues);
    res.status(200).json({ message: 'Referral Offer added successfully', referralCode });
  } catch (err) {
    console.error('Error adding referral offer:', err);
    res.status(500).json({ message: 'Database error', error: err });
  }
};

const updateReferralOffer = async (req, res) => {
  const { id } = req.params;
  const { referralName, description, packageDiscount, addHearts, startDate, expiryDate } = req.body;

  const updateQuery = `
    UPDATE referral_code_offers
    SET referral_name = ?, description = ?, package_discount = ?, add_hearts = ?, start_date = ?, expiry_date = ?
    WHERE id = ?
  `;
  const updateValues = [referralName, description, packageDiscount, addHearts, startDate, expiryDate, id];

  db.query(updateQuery, updateValues, (err, results) => {
    if (err) {
      console.error('Error updating referral offer:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Referral offer not found' });
    }

    res.status(200).json({ message: 'Referral offer updated successfully' });
  });
};

const deleteReferralOffer = async (req, res) => {
  const { id } = req.params;

  const deleteQuery = 'DELETE FROM referral_code_offers WHERE id = ?';

  db.query(deleteQuery, [id], (err, results) => {
    if (err) {
      console.error('Error deleting referral offer:', err);
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Referral offer not found' });
    }

    res.status(200).json({ message: 'Referral offer deleted successfully' });
  });
};


module.exports = {
  getAllReferralOffersForAdmin,
  AddNewReferralOffersForAdmin,
  updateReferralOffer,
  deleteReferralOffer
};
