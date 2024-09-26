const database = require("../config/db");
const moment = require("moment-timezone");

const db = database.connection;

// Get the start and end dates for the current month in Sri Lanka timezone
const getCurrentMonthDateRange = () => {
  // Get the current date and time in Sri Lanka timezone
  const now = moment.tz("Asia/Colombo");

  // Set the start and end of the current month
  const start = now.clone().startOf("month").toDate();
  const end = now.clone().endOf("month").toDate();
  return [start, end];
};
// Fetch dashboard data
const getDashboardPaymentsData = (req, res) => {
  const [startOfMonth, endOfMonth] = getCurrentMonthDateRange();

  const queries = [
    // Overall totals
    `WITH FirstEntries AS (
    SELECT MIN(id) AS first_id
    FROM packagesbuydata
    GROUP BY userId
),
EligiblePayments AS (
    SELECT *
    FROM packagesbuydata
    WHERE id NOT IN (SELECT first_id FROM FirstEntries)
)
SELECT 
    SUM(price) AS total_approved_payments, 
    COUNT(DISTINCT userId) AS total_users_paid
FROM EligiblePayments
WHERE approved = 1 
  AND (payment_status = 1 OR payment_status = 0)
`,

    `SELECT 
            SUM(total_price) AS total_approved_payments, 
            COUNT(DISTINCT userId) AS total_users_paid
         FROM heartsbuydata
         WHERE approved = 1;`,

    // Current month totals
    `WITH FirstEntries AS (
    SELECT MIN(id) AS first_id
    FROM packagesbuydata
    GROUP BY userId
),
EligiblePayments AS (
    SELECT *
    FROM packagesbuydata
    WHERE id NOT IN (SELECT first_id FROM FirstEntries)
)
SELECT 
    SUM(price) AS total_approved_payments, 
    COUNT(DISTINCT userId) AS total_users_paid
FROM EligiblePayments
WHERE approved = 1 
  AND (payment_status = 1 OR payment_status = 0)
  AND payment_date BETWEEN ? AND ?;  -- Add date range condition here
`,

    `SELECT 
            SUM(total_price) AS total_approved_payments, 
            COUNT(DISTINCT userId) AS total_users_paid
         FROM heartsbuydata
         WHERE approved = 1 
           AND payment_date BETWEEN ? AND ?;`,
  ];

  const params = [
    [], // Parameters for the first query
    [], // Parameters for the second query
    [startOfMonth, endOfMonth], // Parameters for the third query
    [startOfMonth, endOfMonth], // Parameters for the fourth query
  ];

  // Execute all queries
  Promise.all(
    queries.map((query, index) => {
      return new Promise((resolve, reject) => {
        db.query(query, params[index], (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results[0]);
          }
        });
      });
    })
  )
    .then((results) => {
      const overallPackages = results[0];
      const overallHearts = results[1];
      const currentMonthPackages = results[2];
      const currentMonthHearts = results[3];

      const response = {
        total: {
          total_approved_payments:
            overallPackages.total_approved_payments +
              overallHearts.total_approved_payments || 0,
          total_users_paid:
            overallPackages.total_users_paid + overallHearts.total_users_paid ||
            0,
        },
        packagesbuydata: {
          total_approved_payments: overallPackages.total_approved_payments || 0,
          total_users_paid: overallPackages.total_users_paid || 0,
        },
        heartsbuydata: {
          total_approved_payments: overallHearts.total_approved_payments || 0,
          total_users_paid: overallHearts.total_users_paid || 0,
        },
        totalcurrentmonth: {
          total_approved_payments:
            currentMonthPackages.total_approved_payments +
              currentMonthHearts.total_approved_payments || 0,
          total_users_paid:
            currentMonthPackages.total_users_paid +
              currentMonthHearts.total_users_paid || 0,
        },
        packagesbuydatacurrentmonth: {
          total_approved_payments:
            currentMonthPackages.total_approved_payments || 0,
          total_users_paid: currentMonthPackages.total_users_paid || 0,
        },
        heartsbuydatacurrentmonth: {
          total_approved_payments:
            currentMonthHearts.total_approved_payments || 0,
          total_users_paid: currentMonthHearts.total_users_paid || 0,
        },
      };

      res.json(response);
    })
    .catch((err) => {
      console.error("Error executing queries:", err);
      res.status(500).json({ error: "Internal server error" });
    });
};

const getDailyPackagePaymentsDataToChart = (req, res) => {
  const [startDate, endDate] = getCurrentMonthDateRange();

  // Format dates for SQL query
  const formattedStartDate = moment(startDate).format("YYYY-MM-DD");
  const formattedEndDate = moment(endDate).format("YYYY-MM-DD");

  // Define the SQL query with CTE for excluding the first entry for each userId
  const query = `
        WITH FirstEntries AS (
            SELECT MIN(id) AS first_id
            FROM packagesbuydata
            GROUP BY userId
        ),
        EligiblePayments AS (
            SELECT *
            FROM packagesbuydata
            WHERE id NOT IN (SELECT first_id FROM FirstEntries)
        )
        SELECT 
            DATE_FORMAT(date_table.payment_date, '%Y-%m-%d') AS day_of_month,
            COALESCE(SUM(p.price), 0) AS total_approved_payments
        FROM 
            (SELECT DATE_ADD(?, INTERVAL seq DAY) AS payment_date
             FROM (SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
                   UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 
                   UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 
                   UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 
                   UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 
                   UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 
                   UNION ALL SELECT 24 UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 
                   UNION ALL SELECT 28 UNION ALL SELECT 29) AS seq_table
             WHERE 
                 DATE_ADD(?, INTERVAL seq DAY) BETWEEN ? AND ?) AS date_table
        LEFT JOIN 
            EligiblePayments p ON DATE(p.payment_date) = DATE(date_table.payment_date)
            AND p.approved = 1 
            AND (p.payment_status = 1 OR p.payment_status = 0)
        GROUP BY 
            day_of_month
        ORDER BY 
            day_of_month;
    `;

  // Execute the query with parameters
  db.query(
    query,
    [
      formattedStartDate,
      formattedStartDate,
      formattedStartDate,
      formattedEndDate,
    ],
    (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      // Process results and send response
      const response = results.map((row) => ({
        day_of_month: row.day_of_month,
        total_approved_payments: row.total_approved_payments,
      }));

      res.json(response);
    }
  );
};

module.exports = {
  getDashboardPaymentsData,
  getDailyPackagePaymentsDataToChart,
}; // Corrected to export getDashboardPaymentsData
