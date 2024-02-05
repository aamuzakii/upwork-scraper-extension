const express = require("express");
const app = express();
const port = 3000;

// Middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleString()} - ${req.method} ${req.url}`);
  next();
});

// Define a sample route
app.get("/", (req, res) => {
  console.log(JSON.stringify(req.query));
  res.send("Hello, this is your Node.js API!");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
