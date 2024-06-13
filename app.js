const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const socketService = require("./services/user-Socket-Service");

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: "*" }));

const port = process.env.PORT || 3000;
const authRoute = require("./routes/user");
const authRoutecoins = require("./routes/coins");

app.get("/", (req, res) => res.send("Hello World!"));
app.use("/api/user", authRoute);
app.use("/api/coins", authRoutecoins);

const database = require("./config/db");
const db = database.connection;
const users = {}; // Track online users



// Pass io, db, and users to the socket service
socketService(io, db, users);


server.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});


