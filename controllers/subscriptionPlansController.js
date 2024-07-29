const database = require("../config/db");
const { verifyToken, getUserData } = require("./UserController");

const db = database.connection;

const getsubscriptionPlans = async (req, res) => {
  const sql = "SELECT * FROM subscription_plans";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching subscription plans:", err);
      return res
        .status(500)
        .json({ message: "Error fetching subscription plans" });
    }

    // Process the results to convert integer values and parse JSON
    const processedResults = results.map((plan) => ({
      ...plan,
      discount: plan.discount === 1, // Convert integer to boolean
      features: JSON.parse(plan.features), // Parse JSON string to object
    }));

    res.status(200).json(processedResults);
  });
};

const getReferralCodeOffers = (referralCode, userId, callback) => {
  const query = "SELECT * FROM referral_code_offers WHERE referral_code = ?";
  db.query(query, [referralCode], (error, results) => {
    if (error) {
      return callback(error, null);
    }

    if (results.length > 0) {
      // Referral code is valid, proceed with setting referral_code to an empty string
      const updateQuery = "UPDATE users SET referral_code = ? WHERE id = ?";
      db.query(updateQuery, [referralCode,userId], (updateError, updateResults) => {
        if (updateError) {
          return callback(updateError, null);
        }
        callback(null, results);
      });
    } else {
      callback(null, results);
    }
  });
};

const processPrice = (priceString) => {
  // Remove the 'LKR/Mon' suffix and convert to number
  return parseFloat(priceString.replace(' LKR/Mon', '').replace(',', ''));
};

const applyDiscount = (price, discount) => {
  // Apply the discount to the price
  return price * (1 - discount);
};

const checkReferralCodeToGetOffers = async (req, res) => {
    // Extract token from the request headers
    const token = req.headers.authorization;

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  
    const userData = await getUserData(decoded.nic);
    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }
    const userId = userData["id"];

  const { referralCode } = req.body;

  if (!referralCode) {
    return res.status(400).json({ message: "Referral code is required" });
  }

  getReferralCodeOffers(referralCode, userId, (error, results) => {
    if (error) {
      return res.status(500).json({ message: "Error retrieving offers" });
    }

    if (results.length > 0) {
      const firstOffer = results[0];
      const startDate = new Date(firstOffer.start_date);
      const expiryDate = new Date(firstOffer.expiry_date);

      // Calculate Sri Lanka time
      const utcOffset = 5.5 * 60 * 60 * 1000; // UTC+5:30 in milliseconds
      const sriLankaTimeNow = new Date(Date.now() + utcOffset);

      // Adjust the expiry date to Sri Lanka time
      const startDateInSriLanka = new Date(startDate.getTime() + utcOffset);
      const expiryDateInSriLanka = new Date(expiryDate.getTime() + utcOffset);

      if (sriLankaTimeNow < startDateInSriLanka) {
        // Offer has not started yet
        res.status(400).json({ message: "Referral code has not started yet" });
      } else if (sriLankaTimeNow > expiryDateInSriLanka) {
        // Referral code has expired
        res.status(400).json({ message: "Referral code has expired" });
      } else {
        const package_discount = firstOffer.package_discount;

        // Parse the JSON string to a JavaScript object
        let packageDiscountObject;
        try {
          packageDiscountObject = JSON.parse(package_discount);
        } catch (error) {
          console.error("Error parsing package_discount:", error);
          return; // Exit the function or handle the error appropriately
        }

        // Access and log each value
        const basicDiscount = packageDiscountObject.basic;
        const premiumDiscount = packageDiscountObject.premium;
        const goldDiscount = packageDiscountObject.gold;

        console.log("Basic Discount:", basicDiscount);
        console.log("Premium Discount:", premiumDiscount);
        console.log("Gold Discount:", goldDiscount);

        const sql = "SELECT * FROM subscription_plans";

        db.query(sql, (err, results) => {
          if (err) {
            console.error("Error fetching subscription plans:", err);
            return res
              .status(500)
              .json({ message: "Error fetching subscription plans" });
          }

          // Calculate updated values
          const updatedPlans = results.map((plan) => {
            const priceNumber = processPrice(plan.price);
            let discount = 0;

            switch (plan.plan_name) {
              case "Basic":
                discount = basicDiscount;
                break;
              case "Premium":
                discount = premiumDiscount;
                break;
              case "Gold":
                discount = goldDiscount;
                break;
            }

            const updatedPrice = applyDiscount(priceNumber, discount);
            const discountPercentage = (discount * 100).toFixed(1) + "%";
            const discountShowValue = `${updatedPrice.toFixed(2)} LKR/Mon`;

            return {
              ...plan,
              discount: discount > 0,
              discount_percentage: discountPercentage,
              discount_show_value: discountShowValue,
              features: JSON.parse(plan.features), 
            };
          });

          // Referral code is valid and offers are available
        res.status(200).json({
          message: "Referral code is valid and offers are available",
          offer: firstOffer,
          updatedPlans: updatedPlans
        });
        });
      }
    } else {
      // Referral code not found
      res.status(400).json({ message: "Invalid referral code" });
    }
  });
};

module.exports = {
  getsubscriptionPlans,
  checkReferralCodeToGetOffers,
};
