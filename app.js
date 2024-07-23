const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const cron = require("node-cron");
const socketService = require("./services/user-Socket-Service");
const authMiddleware = require('./middlewares/authMiddleware.js');
const bodyParser = require('body-parser');

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: "*" }));

const port = process.env.PORT || 3000;
const authRoute = require("./routes/user");
const authRoutecoins = require("./routes/coins");
const authRoutePackages = require("./routes/packages");
const authRouteAdmin= require("./routes/admin");
const authRouteForgetpassword = require("./routes/forgetpassword");
const authRouteSubscriptionPlans = require("./routes/subscriptionPlans");

app.get("/", (req, res) => res.send("Hello World!"));
app.use("/api/user", authRoute);
app.use("/api/coins", authRoutecoins);
app.use("/api/packages", authRoutePackages);
app.use(bodyParser.json());
app.use("/api/forgetpassword", authRouteForgetpassword);
app.use("/api/subscriptionPlans", authRouteSubscriptionPlans);
app.use(authMiddleware);
app.use("/api/admin", authRouteAdmin);

const database = require("./config/db");
const db = database.connection;

const users = {}; // Track online users



// Pass io, db, and users to the socket service
socketService(io, db, users);



// Define the task to be executed
const checkAndUpdateStatus = () => {
  const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const query = `
      UPDATE packagesbuydata
      SET payment_status = CASE WHEN packageStartEnd < '${currentDate}' THEN 0 ELSE payment_status END
      WHERE packageStartEnd < '${currentDate}' AND payment_status = 1
  `;
  db.query(query, (error, results) => {
      if (error) {

      } else {

      }
  });
};




// Schedule task to run every 10 seconds
cron.schedule('*/10 * * * * *', () => {
  console.log('Running task...');
  checkAndUpdateStatus();
});

// Initial check when the application starts
checkAndUpdateStatus();

// Handle application shutdown gracefully
process.on('SIGINT', () => {
  console.log('Closing MySQL connection and stopping scheduler...');
  db.end();
  process.exit();
});


server.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});


