const express = require("express");
const app = express();
const port = 3000;
const bodyParser = require("body-parser");

// Middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleString()} - ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// Define a sample route
app.post("/store", async (req, res) => {
  const executor = (resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      resolve(data);
    });

    req.on("error", (error) => {
      reject(error);
    });
  };

  const body = await new Promise(executor);

  const requestBody = JSON.parse(body);
  console.log(requestBody);
  res.send("Hello, this is your Node.js API!");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
